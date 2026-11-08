import type pg from "pg";
import type { Calendar, DayType } from "./calendar.ts";
import type { Clock } from "./clock.ts";
import { directionName, directionPlatforms, isScheduled, stopName, type DirectionName, type Name } from "./networkSql.ts";
import type { TransportMode } from "./osm/networkMapper.ts";
import { localDirectionName, type Language } from "./passengerNetwork.ts";

export interface JourneyStop {
  id: number;
  name: string;
}

export interface Leg {
  routeId: number;
  number: string;
  mode: TransportMode;
  directionId: number;
  directionName: string;
  fromStop: JourneyStop;
  toStop: JourneyStop;
  departure: string;
  arrival: string;
}

export interface Journey {
  departure: string;
  arrival: string;
  transfers: number;
  legs: Leg[];
}

export interface JourneyPlanner {
  journeys(from: number, to: number, at: Date | undefined, language: Language): Promise<Journey[] | null>;
}

interface TimetableStop {
  stopId: number;
  name: Name;
  offset: number;
}

interface TimetableDirection {
  routeId: number;
  number: string;
  mode: TransportMode;
  directionId: number;
  name: DirectionName;
  stops: TimetableStop[];
  departures: Partial<Record<DayType, number[]>>;
}

interface Candidate {
  direction: TimetableDirection;
  board: TimetableStop;
  alight: TimetableStop;
  departure: number;
  arrival: number;
}

const minute = 60_000;
const day = 1440 * minute;
const minskOffset = 180 * minute;
const windowMinutes = 120;
const maxJourneys = 5;

const timetableQuery = `
  SELECT r.id AS "routeId", r.number, r.transport_mode AS mode, d.id AS "directionId", ${directionName} AS name,
    ${directionPlatforms(`'stopId', s.id, 'name', ${stopName("s")}, 'offset', dp.travel_offset`)} AS stops,
    (SELECT json_object_agg(day_type, minutes) FROM (
      SELECT day_type, json_agg(minutes ORDER BY minutes) AS minutes FROM departures WHERE direction_id = d.id GROUP BY day_type) t) AS departures
  FROM routes r JOIN directions d ON d.route_id = r.id
  WHERE NOT r.withdrawn AND ${isScheduled}`;

const minskDate = (time: number) => new Date(time + minskOffset).toISOString().slice(0, 10);

const minskMidnight = (date: string) => Date.parse(`${date}T00:00:00.000Z`) - minskOffset;

const minskTime = (time: number) => `${new Date(time + minskOffset).toISOString().slice(0, 19)}+03:00`;

function rides({ stops }: TimetableDirection, from: number, to: number): [TimetableStop, TimetableStop][] {
  return stops.flatMap((board, index) => {
    const alight = board.stopId === from ? stops.slice(index + 1).find((stop) => stop.stopId === to) : undefined;
    return alight ? [[board, alight] as [TimetableStop, TimetableStop]] : [];
  });
}

const dominates = (other: Candidate, candidate: Candidate) =>
  other.departure >= candidate.departure &&
  other.arrival <= candidate.arrival &&
  (other.departure > candidate.departure || other.arrival < candidate.arrival);

function toJourney({ direction, board, alight, departure, arrival }: Candidate, language: Language): Journey {
  const leg: Leg = {
    routeId: direction.routeId,
    number: direction.number,
    mode: direction.mode,
    directionId: direction.directionId,
    directionName: localDirectionName(direction.name, language),
    fromStop: { id: board.stopId, name: board.name[language] },
    toStop: { id: alight.stopId, name: alight.name[language] },
    departure: minskTime(departure),
    arrival: minskTime(arrival),
  };
  return { departure: leg.departure, arrival: leg.arrival, transfers: 0, legs: [leg] };
}

export function createJourneyPlanner({ pool, calendar, clock }: { pool: pg.Pool; calendar: Calendar; clock: Clock }): JourneyPlanner {
  return {
    async journeys(from, to, at = clock.now(), language) {
      const { rows } = await pool.query<TimetableDirection>(timetableQuery);
      const visible = new Set(rows.flatMap((direction) => direction.stops.map((stop) => stop.stopId)));
      if (!visible.has(from) || !visible.has(to)) {
        return null;
      }
      const start = at.getTime();
      const end = start + windowMinutes * minute;
      const serviceDays = await Promise.all(
        [-1, 0, 1].map(async (shift) => {
          const date = minskDate(start + shift * day);
          return { midnight: minskMidnight(date), dayType: (await calendar.dayInfo(date)).dayType };
        }),
      );
      const candidates = rows
        .flatMap((direction) =>
          rides(direction, from, to).flatMap(([board, alight]) =>
            serviceDays.flatMap(({ midnight, dayType }) =>
              (direction.departures[dayType] ?? []).map((minutes) => ({
                direction,
                board,
                alight,
                departure: midnight + (minutes + board.offset) * minute,
                arrival: midnight + (minutes + alight.offset) * minute,
              })),
            ),
          ),
        )
        .filter(({ departure }) => departure >= start && departure <= end);
      return candidates
        .filter((candidate) => !candidates.some((other) => dominates(other, candidate)))
        .sort((a, b) => a.departure - b.departure || a.arrival - b.arrival)
        .slice(0, maxJourneys)
        .map((candidate) => toJourney(candidate, language));
    },
  };
}
