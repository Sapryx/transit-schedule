import type { Config } from "../config.ts";

type Tags = Record<string, string>;

export interface OsmMember {
  type: "node" | "way" | "relation";
  ref: number;
  role: string;
}

export type OsmElement =
  | { type: "node"; id: number; lat: number; lon: number; tags?: Tags }
  | { type: "way"; id: number; geometry: { lat: number; lon: number }[]; tags?: Tags }
  | { type: "relation"; id: number; members: OsmMember[]; tags?: Tags };

export interface OsmSource {
  fetchElements(): Promise<OsmElement[]>;
}

const gomel = "(52.35,30.85,52.50,31.10)";

const query = `[out:json][timeout:180];
relation["type"="route"]["route"~"^(bus|trolleybus)$"]${gomel}->.routes;
(.routes; relation(br.routes)["type"="route_master"]; relation["public_transport"="stop_area"]${gomel};);
out body;
(node(r.routes); way(r.routes););
out geom;`;

export function createOverpassSource({ config }: { config: Config }): OsmSource {
  return {
    async fetchElements() {
      const response = await fetch(config.overpassUrl, {
        method: "POST",
        headers: { "User-Agent": "transit-schedule" },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(200_000),
      });
      if (!response.ok) {
        throw new Error(`Overpass responded with ${response.status}`);
      }
      const body = (await response.json()) as { elements: OsmElement[] };
      return body.elements;
    },
  };
}
