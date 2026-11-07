import { asValue } from "awilix";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { belarusPublicHolidays } from "./calendar.ts";
import { useTestServer } from "./testing/testServer.ts";

describe("belarusPublicHolidays", () => {
  it("lists the public holidays of 2026 with Radunitsa on 21 April", () => {
    expect(belarusPublicHolidays(2026)).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-07",
      "2026-03-08",
      "2026-04-21",
      "2026-05-01",
      "2026-05-09",
      "2026-07-03",
      "2026-11-07",
      "2026-12-25",
    ]);
  });

  it("places Radunitsa of 2027 on 11 May", () => {
    expect(belarusPublicHolidays(2027)).toContain("2027-05-11");
  });

  it("places Radunitsa of 2025 on 29 April", () => {
    expect(belarusPublicHolidays(2025)).toContain("2025-04-29");
  });
});

describe("calendar endpoints", () => {
  const server = useTestServer();
  let now: Date;

  beforeEach(() => {
    now = new Date("2026-11-06T21:30:00.000Z");
    server.container.register({ clock: asValue({ now: () => now }) });
  });

  let token: string;

  beforeEach(async () => {
    const response = await request(server.container.cradle.app)
      .post("/api/auth/login")
      .send({ login: "dispatcher", password: "secret" });
    token = response.body.token;
  });

  function admin(method: "get" | "post" | "delete", path: string) {
    return request(server.container.cradle.app)[method](path).set("Authorization", `Bearer ${token}`);
  }

  describe("seeding", () => {
    it("fills an empty table with the holidays of the current and next year", async () => {
      const { calendar, pool } = server.container.cradle;

      await calendar.seedHolidays();

      const { rows } = await pool.query("SELECT to_char(date, 'YYYY-MM-DD') AS date FROM holidays ORDER BY date");
      expect(rows.map((row) => row.date)).toEqual([...belarusPublicHolidays(2026), ...belarusPublicHolidays(2027)]);
    });

    it("does not reseed a table the dispatcher has changed", async () => {
      const { calendar, pool } = server.container.cradle;
      await calendar.seedHolidays();
      await pool.query("DELETE FROM holidays WHERE date <> '2026-12-25'");

      await calendar.seedHolidays();

      const { rows } = await pool.query("SELECT count(*)::int AS count FROM holidays");
      expect(rows).toEqual([{ count: 1 }]);
    });
  });

  describe("GET /api/calendar/day-type", () => {
    beforeEach(async () => {
      await server.container.cradle.calendar.seedHolidays();
    });

    it.each([
      { date: "2026-11-09", dayType: "weekday", holiday: false },
      { date: "2026-11-08", dayType: "weekend", holiday: false },
      { date: "2026-11-14", dayType: "weekend", holiday: false },
      { date: "2026-12-25", dayType: "weekend", holiday: true },
      { date: "2027-05-11", dayType: "weekend", holiday: true },
    ])("tells the day type of $date", async (expected) => {
      const response = await request(server.container.cradle.app).get(`/api/calendar/day-type?date=${expected.date}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expected);
    });

    it("defaults to today in Minsk", async () => {
      const response = await request(server.container.cradle.app).get("/api/calendar/day-type");

      expect(response.body).toEqual({ date: "2026-11-07", dayType: "weekend", holiday: true });
    });

    it.each(["2026-02-30", "07.11.2026", "tomorrow"])("refuses the invalid date %s", async (date) => {
      const response = await request(server.container.cradle.app).get(`/api/calendar/day-type?date=${date}`);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ error: "invalid_date" });
    });
  });

  describe("/api/admin/holidays", () => {
    it("requires a dispatcher", async () => {
      const response = await request(server.container.cradle.app).get("/api/admin/holidays");

      expect(response.status).toBe(401);
    });

    it("lists holidays from today on, or all with past ones", async () => {
      const { pool } = server.container.cradle;
      await pool.query("INSERT INTO holidays (date) VALUES ('2026-12-25'), ('2026-01-01'), ('2026-11-07')");

      const upcoming = await admin("get", "/api/admin/holidays");
      const all = await admin("get", "/api/admin/holidays?past=true");

      expect(upcoming.status).toBe(200);
      expect(upcoming.body).toEqual([{ date: "2026-11-07" }, { date: "2026-12-25" }]);
      expect(all.body).toEqual([{ date: "2026-01-01" }, { date: "2026-11-07" }, { date: "2026-12-25" }]);
    });

    it("adds a holiday that changes the day type", async () => {
      const response = await admin("post", "/api/admin/holidays").send({ date: "2026-11-10" });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ date: "2026-11-10" });
      const dayType = await request(server.container.cradle.app).get("/api/calendar/day-type?date=2026-11-10");
      expect(dayType.body).toEqual({ date: "2026-11-10", dayType: "weekend", holiday: true });
    });

    it("refuses a duplicate date", async () => {
      await admin("post", "/api/admin/holidays").send({ date: "2026-11-10" });

      const response = await admin("post", "/api/admin/holidays").send({ date: "2026-11-10" });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: "duplicate_date" });
    });

    it.each([{ date: "2026-13-01" }, { date: 20261110 }, {}])("refuses to add %o", async (body) => {
      const response = await admin("post", "/api/admin/holidays").send(body);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ error: "invalid_date" });
    });

    it("removes a holiday", async () => {
      await admin("post", "/api/admin/holidays").send({ date: "2026-11-10" });

      const response = await admin("delete", "/api/admin/holidays/2026-11-10");

      expect(response.status).toBe(204);
      expect((await admin("get", "/api/admin/holidays")).body).toEqual([]);
    });

    it("reports removing an unknown holiday", async () => {
      const response = await admin("delete", "/api/admin/holidays/2026-11-10");

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: "not_found" });
    });

    it("refuses to remove an invalid date", async () => {
      const response = await admin("delete", "/api/admin/holidays/2026-02-30");

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ error: "invalid_date" });
    });
  });
});
