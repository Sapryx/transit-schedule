import { readFile } from "node:fs/promises";
import type { OsmElement } from "../osm/osmSource.ts";

export async function overpassFixture(): Promise<OsmElement[]> {
  const response = JSON.parse(await readFile(new URL("./overpass-gomel.json", import.meta.url), "utf8"));
  return response.elements;
}
