import type pg from "pg";
import { transaction } from "../database.ts";
import { mapNetwork, type SkippedRoute } from "./networkMapper.ts";
import type { OsmSource } from "./osmSource.ts";

interface Count {
  created: number;
}

export interface SyncReport {
  stops: Count;
  platforms: Count;
  routes: Count;
  directions: Count;
  skippedRoutes: SkippedRoute[];
}

export interface NetworkSync {
  run(): Promise<SyncReport>;
  syncIfEmpty(): Promise<void>;
}

export function createNetworkSync({ pool, osmSource }: { pool: pg.Pool; osmSource: OsmSource }): NetworkSync {
  async function run(): Promise<SyncReport> {
    const network = mapNetwork(await osmSource.fetchElements());
    const directions = network.routes.flatMap((route) => route.directions.map((direction) => ({ routeOsmId: route.osmId, ...direction })));

    return transaction(pool, async (client) => {
      const stops = await client.query(
        `INSERT INTO stops (osm_id, name_ru, name_en)
         SELECT * FROM unnest($1::text[], $2::text[], $3::text[])
         ON CONFLICT (osm_id) DO NOTHING`,
        [network.stops.map((stop) => stop.osmId), network.stops.map((stop) => stop.nameRu), network.stops.map((stop) => stop.nameEn)],
      );
      const platforms = await client.query(
        `INSERT INTO platforms (osm_id, stop_id, latitude, longitude)
         SELECT p.osm_id, s.id, p.latitude, p.longitude
         FROM unnest($1::text[], $2::text[], $3::float8[], $4::float8[]) AS p (osm_id, stop_osm_id, latitude, longitude)
         JOIN stops s ON s.osm_id = p.stop_osm_id
         ON CONFLICT (osm_id) DO NOTHING`,
        [
          network.platforms.map((platform) => platform.osmId),
          network.platforms.map((platform) => platform.stopOsmId),
          network.platforms.map((platform) => platform.latitude),
          network.platforms.map((platform) => platform.longitude),
        ],
      );
      const routes = await client.query(
        `INSERT INTO routes (osm_id, number, transport_mode)
         SELECT * FROM unnest($1::text[], $2::text[], $3::text[])
         ON CONFLICT (osm_id) DO NOTHING`,
        [network.routes.map((route) => route.osmId), network.routes.map((route) => route.number), network.routes.map((route) => route.transportMode)],
      );
      const createdDirections = await client.query<{ osm_id: string }>(
        `INSERT INTO directions (osm_id, route_id, via_stop_id, path)
         SELECT d.osm_id, r.id, s.id, d.path
         FROM unnest($1::text[], $2::text[], $3::text[], $4::jsonb[]) AS d (osm_id, route_osm_id, via_stop_osm_id, path)
         JOIN routes r ON r.osm_id = d.route_osm_id
         LEFT JOIN stops s ON s.osm_id = d.via_stop_osm_id
         ON CONFLICT (osm_id) DO NOTHING
         RETURNING osm_id`,
        [
          directions.map((direction) => direction.osmId),
          directions.map((direction) => direction.routeOsmId),
          directions.map((direction) => direction.viaStopOsmId),
          directions.map((direction) => JSON.stringify(direction.path)),
        ],
      );
      const created = new Set(createdDirections.rows.map((row) => row.osm_id));
      const sequence = directions
        .filter((direction) => created.has(direction.osmId))
        .flatMap((direction) => direction.platformOsmIds.map((platformOsmId, position) => ({ directionOsmId: direction.osmId, position, platformOsmId })));
      await client.query(
        `INSERT INTO direction_platforms (direction_id, position, platform_id)
         SELECT d.id, x.position, p.id
         FROM unnest($1::text[], $2::int[], $3::text[]) AS x (direction_osm_id, position, platform_osm_id)
         JOIN directions d ON d.osm_id = x.direction_osm_id
         JOIN platforms p ON p.osm_id = x.platform_osm_id`,
        [sequence.map((item) => item.directionOsmId), sequence.map((item) => item.position), sequence.map((item) => item.platformOsmId)],
      );

      return {
        stops: { created: stops.rowCount ?? 0 },
        platforms: { created: platforms.rowCount ?? 0 },
        routes: { created: routes.rowCount ?? 0 },
        directions: { created: created.size },
        skippedRoutes: network.skippedRoutes,
      };
    });
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
