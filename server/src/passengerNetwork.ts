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

export interface PassengerNetwork {
  routes(language: Language): Promise<PassengerRoute[]>;
  route(id: number, language: Language): Promise<PassengerRoute<PassengerDirectionDetail> | null>;
}

type Row<D> = PassengerRoute<Omit<D, "name" | "stops"> & { name: DirectionName; stops?: (Omit<PassengerStop, "name"> & { name: Name })[] }>;

const viaWord: Record<Language, string> = { en: "via", ru: "через" };

const byNumber = new Intl.Collator("en", { numeric: true });

function localize<D>(route: Row<D>, language: Language): PassengerRoute<D> {
  return {
    ...route,
    directions: route.directions.map(({ name: { from, to, via }, stops, ...direction }) => ({
      ...direction,
      name: `${from[language]} → ${to[language]}${via ? ` ${viaWord[language]} ${via[language]}` : ""}`,
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

export function createPassengerNetwork({ pool }: { pool: pg.Pool }): PassengerNetwork {
  return {
    async routes(language) {
      const { rows } = await pool.query<Row<PassengerDirection>>(routeQuery("", ""));
      return rows.map((route) => localize(route, language)).sort((a, b) => byNumber.compare(a.number, b.number) || a.mode.localeCompare(b.mode));
    },

    async route(id, language) {
      const { rows } = await pool.query<Row<PassengerDirectionDetail>>(routeQuery(directionDetail, "AND r.id = $1"), [id]);
      return rows[0] ? localize(rows[0], language) : null;
    },
  };
}
