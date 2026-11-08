import type pg from "pg";
import { directionName, directionPlatforms, isScheduled, stopName, type DirectionName, type Name } from "./networkSql.ts";
import type { Point, TransportMode } from "./osm/networkMapper.ts";

export const languages = ["en", "ru"] as const;
export type Language = (typeof languages)[number];

export interface PassengerRoute<D = PassengerDirection> {
  id: number;
  number: string;
  mode: TransportMode;
  directions: D[];
}

export interface PassengerDirection {
  id: number;
  name: string;
}

export interface PassengerStop {
  stopId: number;
  platformId: number;
  name: string;
  lat: number;
  lon: number;
  travelOffset: number;
}

export interface PassengerDirectionDetail extends PassengerDirection {
  stops: PassengerStop[];
  path: Point[];
}

export interface StopRoute {
  id: number;
  number: string;
  mode: TransportMode;
}

export interface StopRouteDetail extends StopRoute {
  directionIds: number[];
}

export interface StopPlatform {
  id: number;
  lat: number;
  lon: number;
}

export interface PassengerStopSummary<R = StopRoute> {
  id: number;
  name: string;
  routes: R[];
  platforms: StopPlatform[];
}

export interface PassengerNetwork {
  routes(language: Language): Promise<PassengerRoute[]>;
  route(id: number, language: Language): Promise<PassengerRoute<PassengerDirectionDetail> | null>;
  stops(query: string, language: Language): Promise<PassengerStopSummary[]>;
  stop(id: number, language: Language): Promise<PassengerStopSummary<StopRouteDetail> | null>;
}

type Row<D> = PassengerRoute<Omit<D, "name" | "stops"> & { name: DirectionName; stops?: (Omit<PassengerStop, "name"> & { name: Name })[] }>;

const viaWord: Record<Language, string> = { en: "via", ru: "через" };

const byNumber = new Intl.Collator("en", { numeric: true });

const byRoute = (a: StopRoute, b: StopRoute) => byNumber.compare(a.number, b.number) || a.mode.localeCompare(b.mode);

export function localDirectionName({ from, to, via }: DirectionName, language: Language): string {
  return `${from[language]} → ${to[language]}${via ? ` ${viaWord[language]} ${via[language]}` : ""}`;
}

function localize<D>(route: Row<D>, language: Language): PassengerRoute<D> {
  return {
    ...route,
    directions: route.directions.map(({ name, stops, ...direction }) => ({
      ...direction,
      name: localDirectionName(name, language),
      ...(stops && { stops: stops.map((stop) => ({ ...stop, name: stop.name[language] })) }),
    })) as D[],
  };
}

const directionDetail = `,
  'stops', ${directionPlatforms(`
      'stopId', s.id, 'platformId', p.id, 'name', ${stopName("s")}, 'lat', p.latitude, 'lon', p.longitude, 'travelOffset', dp.travel_offset`)},
  'path', d.path`;

const routeQuery = (detail: string, where: string) => `
  SELECT r.id, r.number, r.transport_mode AS mode,
    json_agg(json_build_object('id', d.id, 'name', ${directionName}${detail}) ORDER BY d.id) AS directions
  FROM routes r JOIN directions d ON d.route_id = r.id
  WHERE NOT r.withdrawn AND ${isScheduled} ${where}
  GROUP BY r.id`;

type StopRow = Omit<PassengerStopSummary<StopRouteDetail>, "name"> & { name: Name };

const visible = `
  SELECT p.stop_id, p.id AS platform_id, d.route_id, d.id AS direction_id
  FROM routes r JOIN directions d ON d.route_id = r.id
  JOIN direction_platforms dp ON dp.direction_id = d.id JOIN platforms p ON p.id = dp.platform_id
  WHERE NOT r.withdrawn AND ${isScheduled}`;

const searchable = (column: string) => `strpos(replace(lower(s.${column}), 'ё', 'е'), $1) > 0`;

const stopQuery = (where: string) => `
  WITH visible AS (${visible})
  SELECT s.id, ${stopName("s")} AS name,
    (SELECT json_agg(json_build_object('id', r.id, 'number', r.number, 'mode', r.transport_mode,
        'directionIds', (SELECT json_agg(DISTINCT v.direction_id ORDER BY v.direction_id) FROM visible v WHERE v.stop_id = s.id AND v.route_id = r.id)))
      FROM routes r WHERE r.id IN (SELECT route_id FROM visible WHERE stop_id = s.id)) AS routes,
    (SELECT json_agg(json_build_object('id', p.id, 'lat', p.latitude, 'lon', p.longitude) ORDER BY p.id)
      FROM platforms p WHERE p.id IN (SELECT platform_id FROM visible WHERE stop_id = s.id)) AS platforms
  FROM stops s WHERE s.id IN (SELECT stop_id FROM visible) AND ${where}`;

function localizeStop(stop: StopRow, language: Language): PassengerStopSummary<StopRouteDetail> {
  return { ...stop, name: stop.name[language], routes: stop.routes.sort(byRoute) };
}

export function createPassengerNetwork({ pool }: { pool: pg.Pool }): PassengerNetwork {
  return {
    async routes(language) {
      const { rows } = await pool.query<Row<PassengerDirection>>(routeQuery("", ""));
      return rows.map((route) => localize(route, language)).sort(byRoute);
    },

    async route(id, language) {
      const { rows } = await pool.query<Row<PassengerDirectionDetail>>(routeQuery(directionDetail, "AND r.id = $1"), [id]);
      return rows[0] ? localize(rows[0], language) : null;
    },

    async stops(query, language) {
      const normalized = query.toLowerCase().replaceAll("ё", "е");
      const { rows } = await pool.query<StopRow>(stopQuery(`(${searchable("name_ru")} OR ${searchable("name_en")})`), [normalized]);
      const byName = new Intl.Collator(language);
      return rows
        .map((row) => localizeStop(row, language))
        .map(({ routes, ...stop }) => ({ ...stop, routes: routes.map(({ directionIds, ...route }) => route) }))
        .sort((a, b) => byName.compare(a.name, b.name) || a.id - b.id);
    },

    async stop(id, language) {
      const { rows } = await pool.query<StopRow>(stopQuery("s.id = $1"), [id]);
      return rows[0] ? localizeStop(rows[0], language) : null;
    },
  };
}
