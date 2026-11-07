const name = (ru: string, en: string) => ({ ru, en });
const volotova = name("Волотова", "Volotova");
const khram = name("Храм", "Khram");
const vokzal = name("Вокзал", "Vokzal");
const direction = (id: number, state: Partial<{ scheduled: boolean; needsReview: boolean; missingFromOsm: boolean }> = {}) => ({
  id,
  name: { from: vokzal, to: volotova, via: null },
  scheduled: false,
  needsReview: false,
  missingFromOsm: false,
  ...state,
});
const route = (id: number, number: string, mode: string, directions: ReturnType<typeof direction>[], state: Partial<{ withdrawn: boolean; missingFromOsm: boolean }> = {}) => ({
  id,
  number,
  mode,
  withdrawn: false,
  missingFromOsm: false,
  directions,
  ...state,
});

export const routes = [
  route(1, "43", "bus", [direction(1, { scheduled: true }), direction(2, { scheduled: true })]),
  route(2, "2", "trolleybus", [direction(3)]),
  route(3, "15", "trolleybus", [direction(4, { scheduled: true, needsReview: true }), direction(5, { scheduled: true })]),
  route(4, "20", "bus", [direction(6, { missingFromOsm: true })], { missingFromOsm: true }),
  route(5, "10а", "bus", [direction(7, { scheduled: true })], { withdrawn: true }),
];

const platform = (platformId: number, stopName: typeof vokzal, travelOffset: number | null) => ({
  platformId,
  stopId: platformId,
  stopName,
  lat: 52.4,
  lon: 31,
  travelOffset,
  interpolated: false,
});

export const routeDetail = {
  ...route(3, "15", "trolleybus", []),
  directions: [
    {
      ...direction(4, { scheduled: true, needsReview: true }),
      name: { from: volotova, to: vokzal, via: khram },
      platforms: [platform(10, volotova, 0), platform(11, khram, 4), platform(12, vokzal, 9)],
      departures: { weekday: [360], weekend: [] as number[] },
      path: [[52.4, 31], [52.41, 31.01]],
    },
    {
      ...direction(5),
      platforms: [platform(12, vokzal, null), platform(10, volotova, null)],
      departures: { weekday: [] as number[], weekend: [] as number[] },
      path: [],
    },
  ],
};
