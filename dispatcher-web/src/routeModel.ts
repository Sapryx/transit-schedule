export interface Name {
  ru: string;
  en: string;
}

export const modes = ["bus", "trolleybus"] as const;

export interface DirectionSummary {
  id: number;
  name: { from: Name; to: Name; via: Name | null };
  scheduled: boolean;
  needsReview: boolean;
  missingFromOsm: boolean;
}

export interface RouteSummary<D = DirectionSummary> {
  id: number;
  number: string;
  mode: (typeof modes)[number];
  withdrawn: boolean;
  missingFromOsm: boolean;
  directions: D[];
}

export interface DirectionPlatform {
  platformId: number;
  stopId: number;
  stopName: Name;
  lat: number;
  lon: number;
  travelOffset: number | null;
  interpolated: boolean;
}

export interface DirectionDetail extends DirectionSummary {
  platforms: DirectionPlatform[];
  departures: { weekday: number[]; weekend: number[] };
  path: [number, number][];
}

export const states = ["scheduled", "unscheduled", "needsReview", "withdrawn", "missing"] as const;
export type State = (typeof states)[number];

const flag = (on: boolean, state: State): State[] => (on ? [state] : []);

export function directionStates(direction: DirectionSummary): State[] {
  return [direction.scheduled ? "scheduled" : "unscheduled", ...flag(direction.needsReview, "needsReview"), ...flag(direction.missingFromOsm, "missing")];
}

export function routeStates(route: RouteSummary): State[] {
  return [
    route.directions.every((direction) => direction.scheduled) ? "scheduled" : "unscheduled",
    ...flag(route.directions.some((direction) => direction.needsReview), "needsReview"),
    ...flag(route.withdrawn, "withdrawn"),
    ...flag(route.missingFromOsm, "missing"),
  ];
}
