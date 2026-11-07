import type pg from "pg";
import { transaction } from "../database.ts";
import { mapNetwork, type SkippedRoute } from "./networkMapper.ts";
import type { OsmElement, OsmSource } from "./osmSource.ts";
import { resequence, type StoredPlatform } from "./resequence.ts";

interface Count {
  created: number;
  updated: number;
  missing: number;
}

export interface SyncReport {
  stops: Count;
  platforms: Count;
  routes: Count;
  directions: Count;
  needsReview: number[];
  skippedRoutes: SkippedRoute[];
}

export interface NetworkSync {
  run(): Promise<SyncReport>;
  syncIfEmpty(): Promise<void>;
}

export type SyncErrorCode = "sync_in_progress" | "overpass_unavailable";

export class SyncError extends Error {
  code: SyncErrorCode;

  constructor(code: SyncErrorCode, cause?: unknown) {
    super(cause instanceof Error ? cause.message : code, { cause });
    this.code = code;
  }
}

type Table = "stops" | "platforms" | "routes" | "directions";

async function markMissing(client: pg.PoolClient, table: Table, osmIds: string[]): Promise<number> {
  const result = await client.query(`UPDATE ${table} SET missing_from_osm = true WHERE NOT missing_from_osm AND osm_id <> ALL($1)`, [osmIds]);
  return result.rowCount ?? 0;
}

function count(rows: { created: boolean }[], missing: number): Count {
  const created = rows.filter((row) => row.created).length;
  return { created, updated: rows.length - created, missing };
}

const sameSequence = (stored: StoredPlatform[], platformIds: number[]) =>
  stored.length === platformIds.length && stored.every((platform, index) => platform.platformId === platformIds[index]);

export function createNetworkSync({ pool, osmSource }: { pool: pg.Pool; osmSource: OsmSource }): NetworkSync {
  let running = false;

  async function fetchElements(): Promise<OsmElement[]> {
    try {
      return await osmSource.fetchElements();
    } catch (error) {
      throw new SyncError("overpass_unavailable", error);
    }
  }

  async function apply(elements: OsmElement[]): Promise<SyncReport> {
    const network = mapNetwork(elements);
    const directions = network.routes.flatMap((route) => route.directions.map((direction) => ({ routeOsmId: route.osmId, ...direction })));

    return transaction(pool, async (client) => {
      const stops = await client.query<{ created: boolean }>(
        `INSERT INTO stops (osm_id, name_ru, name_en)
         SELECT * FROM unnest($1::text[], $2::text[], $3::text[])
         ON CONFLICT (osm_id) DO UPDATE SET name_ru = excluded.name_ru, name_en = excluded.name_en, missing_from_osm = false
         WHERE (stops.name_ru, stops.name_en, stops.missing_from_osm) IS DISTINCT FROM (excluded.name_ru, excluded.name_en, false)
         RETURNING xmax = 0 AS created`,
        [network.stops.map((stop) => stop.osmId), network.stops.map((stop) => stop.nameRu), network.stops.map((stop) => stop.nameEn)],
      );
      const platforms = await client.query<{ created: boolean }>(
        `INSERT INTO platforms (osm_id, stop_id, latitude, longitude)
         SELECT p.osm_id, s.id, p.latitude, p.longitude
         FROM unnest($1::text[], $2::text[], $3::float8[], $4::float8[]) AS p (osm_id, stop_osm_id, latitude, longitude)
         JOIN stops s ON s.osm_id = p.stop_osm_id
         ON CONFLICT (osm_id) DO UPDATE SET stop_id = excluded.stop_id, latitude = excluded.latitude, longitude = excluded.longitude, missing_from_osm = false
         WHERE (platforms.stop_id, platforms.latitude, platforms.longitude, platforms.missing_from_osm)
           IS DISTINCT FROM (excluded.stop_id, excluded.latitude, excluded.longitude, false)
         RETURNING xmax = 0 AS created`,
        [
          network.platforms.map((platform) => platform.osmId),
          network.platforms.map((platform) => platform.stopOsmId),
          network.platforms.map((platform) => platform.latitude),
          network.platforms.map((platform) => platform.longitude),
        ],
      );
      const routes = await client.query<{ created: boolean }>(
        `INSERT INTO routes (osm_id, number, transport_mode)
         SELECT * FROM unnest($1::text[], $2::text[], $3::text[])
         ON CONFLICT (osm_id) DO UPDATE SET number = excluded.number, transport_mode = excluded.transport_mode, missing_from_osm = false
         WHERE (routes.number, routes.transport_mode, routes.missing_from_osm) IS DISTINCT FROM (excluded.number, excluded.transport_mode, false)
         RETURNING xmax = 0 AS created`,
        [network.routes.map((route) => route.osmId), network.routes.map((route) => route.number), network.routes.map((route) => route.transportMode)],
      );
      const upsertedDirections = await client.query<{ id: number; created: boolean }>(
        `INSERT INTO directions (osm_id, route_id, via_stop_id, path)
         SELECT d.osm_id, r.id, s.id, d.path
         FROM unnest($1::text[], $2::text[], $3::text[], $4::jsonb[]) AS d (osm_id, route_osm_id, via_stop_osm_id, path)
         JOIN routes r ON r.osm_id = d.route_osm_id
         LEFT JOIN stops s ON s.osm_id = d.via_stop_osm_id
         ON CONFLICT (osm_id) DO UPDATE SET route_id = excluded.route_id, via_stop_id = excluded.via_stop_id, path = excluded.path, missing_from_osm = false
         WHERE (directions.route_id, directions.via_stop_id, directions.path, directions.missing_from_osm)
           IS DISTINCT FROM (excluded.route_id, excluded.via_stop_id, excluded.path, false)
         RETURNING id, xmax = 0 AS created`,
        [
          directions.map((direction) => direction.osmId),
          directions.map((direction) => direction.routeOsmId),
          directions.map((direction) => direction.viaStopOsmId),
          directions.map((direction) => JSON.stringify(direction.path)),
        ],
      );

      const directionIds = new Map(
        (await client.query<{ id: number; osm_id: string }>("SELECT id, osm_id FROM directions WHERE osm_id = ANY($1)", [directions.map((direction) => direction.osmId)])).rows.map(
          (row) => [row.osm_id, row.id],
        ),
      );
      const platformIds = new Map(
        (await client.query<{ id: number; osm_id: string }>("SELECT id, osm_id FROM platforms WHERE osm_id = ANY($1)", [network.platforms.map((platform) => platform.osmId)])).rows.map(
          (row) => [row.osm_id, row.id],
        ),
      );
      const stored = new Map<number, StoredPlatform[]>();
      const sequences = await client.query<{ direction_id: number; platform_id: number; travel_offset: number | null }>(
        "SELECT direction_id, platform_id, travel_offset FROM direction_platforms WHERE direction_id = ANY($1) ORDER BY direction_id, position",
        [[...directionIds.values()]],
      );
      for (const row of sequences.rows) {
        stored.set(row.direction_id, [...(stored.get(row.direction_id) ?? []), { platformId: row.platform_id, travelOffset: row.travel_offset }]);
      }
      const departed = new Set(
        (await client.query<{ direction_id: number }>("SELECT DISTINCT direction_id FROM departures WHERE direction_id = ANY($1)", [[...directionIds.values()]])).rows.map((row) => row.direction_id),
      );

      const resequenced = directions
        .map((direction) => ({ id: directionIds.get(direction.osmId)!, platformIds: direction.platformOsmIds.map((osmId) => platformIds.get(osmId)!) }))
        .filter((direction) => !sameSequence(stored.get(direction.id) ?? [], direction.platformIds))
        .map((direction) => {
          const previous = stored.get(direction.id) ?? [];
          return { ...direction, offsets: resequence(previous, direction.platformIds), scheduled: departed.has(direction.id) || previous.some((platform) => platform.travelOffset !== null) };
        });
      const sequence = resequenced.flatMap((direction) => direction.platformIds.map((platformId, position) => ({ directionId: direction.id, position, platformId, offset: direction.offsets[position] })));
      await client.query("DELETE FROM direction_platforms WHERE direction_id = ANY($1)", [resequenced.map((direction) => direction.id)]);
      await client.query(
        `INSERT INTO direction_platforms (direction_id, position, platform_id, travel_offset)
         SELECT * FROM unnest($1::int[], $2::int[], $3::int[], $4::int[])`,
        [sequence.map((item) => item.directionId), sequence.map((item) => item.position), sequence.map((item) => item.platformId), sequence.map((item) => item.offset)],
      );
      const needsReview = resequenced.filter((direction) => direction.scheduled).map((direction) => direction.id);
      await client.query("UPDATE directions SET needs_review = true WHERE id = ANY($1)", [needsReview]);

      const upserted = new Set(upsertedDirections.rows.map((row) => row.id));
      const directionRows = [...upsertedDirections.rows, ...resequenced.filter((direction) => !upserted.has(direction.id)).map(() => ({ created: false }))];

      return {
        stops: count(stops.rows, await markMissing(client, "stops", network.stops.map((stop) => stop.osmId))),
        platforms: count(platforms.rows, await markMissing(client, "platforms", network.platforms.map((platform) => platform.osmId))),
        routes: count(routes.rows, await markMissing(client, "routes", network.routes.map((route) => route.osmId))),
        directions: count(directionRows, await markMissing(client, "directions", directions.map((direction) => direction.osmId))),
        needsReview,
        skippedRoutes: network.skippedRoutes,
      };
    });
  }

  async function run(): Promise<SyncReport> {
    if (running) {
      throw new SyncError("sync_in_progress");
    }
    running = true;
    try {
      return await apply(await fetchElements());
    } finally {
      running = false;
    }
  }

  return {
    run,

    async syncIfEmpty() {
      try {
        const { rows } = await pool.query<{ filled: boolean }>("SELECT EXISTS (SELECT FROM routes) AS filled");
        if (rows[0].filled) {
          return;
        }
        const report = await run();
        console.log(`OSM sync created ${report.routes.created} route(s), ${report.directions.created} direction(s) and ${report.stops.created} stop(s)`);
      } catch (error) {
        console.error(`OSM sync failed: ${(error as Error).message}`);
      }
    },
  };
}
