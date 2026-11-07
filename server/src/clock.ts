export interface Clock {
  now(): Date;
}

export function createSystemClock(): Clock {
  return { now: () => new Date() };
}
