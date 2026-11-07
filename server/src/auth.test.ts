import { asValue } from "awilix";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildContainer } from "./container.ts";

const signInTime = new Date("2026-11-07T08:00:00.000Z");

function buildApp() {
  let now = signInTime;
  const container = buildContainer({
    port: 0,
    dispatcherLogin: "dispatcher",
    dispatcherPassword: "secret",
    jwtSecret: "test-jwt-secret",
  });
  container.register({ clock: asValue({ now: () => now }) });
  return {
    app: container.cradle.app,
    advanceTo: (time: Date) => {
      now = time;
    },
  };
}

async function signIn(app: Parameters<typeof request>[0]): Promise<string> {
  const response = await request(app).post("/api/auth/login").send({ login: "dispatcher", password: "secret" });
  return response.body.token;
}

describe("POST /api/auth/login", () => {
  it("issues a 12-hour token for the configured credentials", async () => {
    const { app } = buildApp();

    const response = await request(app).post("/api/auth/login").send({ login: "dispatcher", password: "secret" });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.expiresAt).toBe("2026-11-07T20:00:00.000Z");
  });

  it.each([
    { login: "dispatcher", password: "wrong" },
    { login: "someone", password: "secret" },
    { login: "dispatcher" },
    {},
  ])("refuses credentials %o", async (body) => {
    const { app } = buildApp();

    const response = await request(app).post("/api/auth/login").send(body);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "invalid_credentials" });
  });
});

describe("/api/admin guard", () => {
  it("lets a request with a valid token through", async () => {
    const { app } = buildApp();
    const token = await signIn(app);

    const response = await request(app).get("/api/admin/unknown").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it("refuses a request without a token", async () => {
    const { app } = buildApp();

    const response = await request(app).get("/api/admin/unknown");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "unauthorized" });
  });

  it("refuses an invalid token", async () => {
    const { app } = buildApp();

    const response = await request(app).get("/api/admin/unknown").set("Authorization", "Bearer not-a-token");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "unauthorized" });
  });

  it("refuses a token signed with another secret", async () => {
    const { app } = buildApp();
    const other = buildContainer({
      port: 0,
      dispatcherLogin: "dispatcher",
      dispatcherPassword: "secret",
      jwtSecret: "another-secret",
    }).cradle.app;
    const token = await signIn(other);

    const response = await request(app).get("/api/admin/unknown").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
  });

  it("refuses an expired token", async () => {
    const { app, advanceTo } = buildApp();
    const token = await signIn(app);
    advanceTo(new Date("2026-11-07T20:00:01.000Z"));

    const response = await request(app).get("/api/admin/unknown").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "unauthorized" });
  });

  it("keeps passenger endpoints public", async () => {
    const { app } = buildApp();

    const response = await request(app).get("/api/unknown");

    expect(response.status).toBe(404);
  });
});
