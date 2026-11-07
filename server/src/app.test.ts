import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildContainer } from "./container.ts";
import { testConfig } from "./testing/testConfig.ts";
import { useTestServer } from "./testing/testServer.ts";

describe("GET /health", () => {
  const server = useTestServer();

  it("reports that the server and the database are up", async () => {
    const response = await request(server.container.cradle.app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", database: "ok" });
  });

  it("reports an unavailable database instead of crashing", async () => {
    const container = buildContainer(testConfig({ databaseUrl: "postgres://transit:transit@127.0.0.1:1/transit" }));

    const response = await request(container.cradle.app).get("/health");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "error", database: "unavailable" });
    await container.dispose();
  });
});
