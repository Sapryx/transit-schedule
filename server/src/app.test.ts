import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildContainer } from "./container.ts";

describe("GET /health", () => {
  it("reports that the server is up", async () => {
    const { app } = buildContainer({ port: 0 }).cradle;

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
