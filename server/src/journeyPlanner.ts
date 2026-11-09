import type pg from "pg";
import type { Calendar, DayType } from "./calendar.ts";
import type { Clock } from "./clock.ts";
import { directionName, directionPlatforms, isScheduled, stopName, type DirectionName, type Name } from "./networkSql.ts";
import type { TransportMode } from "./osm/networkMapper.ts";
import { localDirectionName, type Language } from "./passengerNetwork.ts";
import { dayTypesAround, minskTime, minute, type DatedDayType } from "./minskTime.ts";

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

interface Pattern {
  direction: TimetableDirection;
  trips: number[];
}

interface Ride {
  direction: TimetableDirection;
  trip: number;
  board: TimetableStop;
  alight: TimetableStop;
}

interface Label {
  arrival: number;
  ride?: Ride;
}

interface Plan {
  departure: number;
  arrival: number;
  rides: Ride[];
}

const windowMinutes = 120;
const maxJourneys = 5;
const maxTrips = 3;
const transferMinutes = 2;
const maxJourneyMinutes = 180;

const timetableQuery = `
  SELECT r.id AS "routeId", r.number, r.transport_mode AS mode, d.id AS "directionId", ${directionName} AS name,
    ${directionPlatforms(`'stopId', s.id, 'name', ${stopName("s")}, 'offset', dp.travel_offset`)} AS stops,
    (SELECT json_object_agg(day_type, minutes) FROM (
      SELECT day_type, json_agg(minutes ORDER BY minutes) AS minutes FROM departures WHERE direction_id = d.id GROUP BY day_type) t) AS departures
  FROM routes r JOIN directions d ON d.route_id = r.id
  WHERE NOT r.withdrawn AND ${isScheduled}`;

const pattern = (direction: TimetableDirection, days: DatedDayType[]): Pattern => ({
  direction,
  trips: days.flatMap(({ midnight, dayType }) => (direction.departures[dayType] ?? []).map((minutes) => midnight + minutes * minute)).sort((a, b) => a - b),
});

const at = (trip: number, stop: TimetableStop) => trip + stop.offset * minute;

function scan({ direction, trips }: Pattern, reached: Map<number, Label>, best: Map<number, number>, next: Map<number, Label>, latest: number) {
  let current: { trip: number; board: TimetableStop } | undefined;
  for (const stop of direction.stops) {
    if (current) {
      const arrival = at(current.trip, stop);
      if (arrival <= latest && arrival < (best.get(stop.stopId) ?? Infinity)) {
        best.set(stop.stopId, arrival);
        next.set(stop.stopId, { arrival, ride: { direction, trip: current.trip, board: current.board, alight: stop } });
      }
    }
    const label = reached.get(stop.stopId);
    if (label) {
      const ready = label.arrival + (label.ride ? transferMinutes * minute : 0);
      const trip = trips.find((candidate) => at(candidate, stop) >= ready);
      if (trip !== undefined && (!current || trip < current.trip)) {
        current = { trip, board: stop };
      }
    }
  }
}

function search(patterns: Pattern[], from: number, to: number, start: number): Plan[] {
  const best = new Map([[from, start]]);
  const rounds = [new Map<number, Label>([[from, { arrival: start }]])];
  for (let round = 1; round <= maxTrips && rounds[round - 1].size > 0; round++) {
    const next = new Map<number, Label>();
    patterns.forEach((pattern) => scan(pattern, rounds[round - 1], best, next, start + maxJourneyMinutes * minute));
    rounds.push(next);
  }
  return rounds.flatMap((labels, round) => {
    const reached = labels.get(to);
    if (!reached) {
      return [];
    }
    const rides: Ride[] = [];
    for (let stop = to, back = round; back > 0; back--) {
      const ride = rounds[back].get(stop)!.ride!;
      rides.unshift(ride);
      stop = ride.board.stopId;
    }
    return [{ departure: at(rides[0].trip, rides[0].board), arrival: reached.arrival, rides }];
  });
}

const dominates = (other: Plan, plan: Plan) =>
  other.departure >= plan.departure &&
  other.arrival <= plan.arrival &&
  other.rides.length <= plan.rides.length &&
  (other.departure > plan.departure || other.arrival < plan.arrival || other.rides.length < plan.rides.length);

const key = (plan: Plan) => plan.rides.map(({ direction, trip, board, alight }) => `${direction.directionId}:${trip}:${board.stopId}:${alight.stopId}`).join("/");

function toLeg({ direction, trip, board, alight }: Ride, language: Language): Leg {
  return {
    routeId: direction.routeId,
    number: direction.number,
    mode: direction.mode,
    directionId: direction.directionId,
    directionName: localDirectionName(direction.name, language),
    fromStop: { id: board.stopId, name: board.name[language] },
    toStop: { id: alight.stopId, name: alight.name[language] },
    departure: minskTime(at(trip, board)),
    arrival: minskTime(at(trip, alight)),
  };
}

const toJourney = (plan: Plan, language: Language): Journey => ({
  departure: minskTime(plan.departure),
  arrival: minskTime(plan.arrival),
  transfers: plan.rides.length - 1,
  legs: plan.rides.map((ride) => toLeg(ride, language)),
});

export function createJourneyPlanner({ pool, calendar, clock }: { pool: pg.Pool; calendar: Calendar; clock: Clock }): JourneyPlanner {
  return {
    async journeys(from, to, requested = clock.now(), language) {
      const { rows } = await pool.query<TimetableDirection>(timetableQuery);
      const visible = new Set(rows.flatMap((direction) => direction.stops.map((stop) => stop.stopId)));
      if (!visible.has(from) || !visible.has(to)) {
        return null;
      }
      const start = requested.getTime();
      const end = start + windowMinutes * minute;
      const days = await dayTypesAround(calendar, start);
      const patterns = rows.map((direction) => pattern(direction, days));
      const starts = new Set(
        patterns.flatMap(({ direction, trips }) =>
          direction.stops.filter((stop) => stop.stopId === from).flatMap((stop) => trips.map((trip) => at(trip, stop))),
        ),
      );
      const plans = new Map(
        [...starts]
          .filter((time) => time >= start && time <= end)
          .flatMap((time) => search(patterns, from, to, time))
          .filter((plan) => plan.departure <= end)
          .map((plan) => [key(plan), plan]),
      );
      const found = [...plans.values()];
      return found
        .filter((plan) => !found.some((other) => dominates(other, plan)))
        .sort((a, b) => a.departure - b.departure || a.arrival - b.arrival || a.rides.length - b.rides.length)
        .slice(0, maxJourneys)
        .map((plan) => toJourney(plan, language));
    },
  };
}
