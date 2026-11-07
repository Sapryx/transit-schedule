import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { testConfig } from "../testing/testConfig.ts";
import { createOverpassSource } from "./osmSource.ts";

describe("Overpass source", () => {
  let server: Server;

  async function overpass(status: number, body: string): Promise<{ url: string; requests: string[] }> {
    const requests: string[] = [];
    server = createServer((req, res) => {
      let text = "";
      req.on("data", (chunk) => (text += chunk));
      req.on("end", () => {
        requests.push(`${req.method} ${decodeURIComponent(text.replace(/\+/g, " "))}`);
        res.writeHead(status, { "Content-Type": "application/json" }).end(body);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/interpreter`, requests };
  }

  afterEach(() => {
    server?.close();
  });

  it("posts the Gomel query to OVERPASS_URL and returns the elements", async () => {
    const { url, requests } = await overpass(200, JSON.stringify({ elements: [{ type: "node", id: 1, lat: 52.4, lon: 31 }] }));

    const elements = await createOverpassSource({ config: testConfig({ overpassUrl: url }) }).fetchElements();

    expect(elements).toEqual([{ type: "node", id: 1, lat: 52.4, lon: 31 }]);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatch(/^POST data=\[out:json\]/);
    expect(requests[0]).toContain("(52.35,30.85,52.50,31.10)");
  });

  it("fails when Overpass responds with an error", async () => {
    const { url } = await overpass(504, "{}");

    await expect(createOverpassSource({ config: testConfig({ overpassUrl: url }) }).fetchElements()).rejects.toThrow("Overpass responded with 504");
  });
});
