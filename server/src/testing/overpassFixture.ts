import { readFile } from "node:fs/promises";
import type { OsmElement } from "../osm/osmSource.ts";

export async function overpassFixture(): Promise<OsmElement[]> {
  const response = JSON.parse(await readFile(new URL("./overpass-gomel.json", import.meta.url), "utf8"));
  return response.elements;
}

const lonePlatform: OsmElement = { type: "node", id: 1, lat: 52.466, lon: 31.03, tags: { public_transport: "platform", "name:ru": "Новая" } };

export function edit(elements: OsmElement[], id: number, change: (element: OsmElement) => OsmElement): OsmElement[] {
  return elements.map((element) => (element.id === id ? change(element) : element));
}

export function insertPlatform(elements: OsmElement[]): OsmElement[] {
  const inserted = edit(elements, 7911648, (element) => {
    const relation = element as Extract<OsmElement, { type: "relation" }>;
    const members = [...relation.members];
    members.splice(members.findIndex((member) => member.ref === 5336093616) + 1, 0, { type: "node", ref: lonePlatform.id, role: "platform" });
    return { ...relation, members };
  });
  return [...inserted, lonePlatform];
}
