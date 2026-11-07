import { asValue } from "awilix";
import { describe, expect, it } from "vitest";
import { buildContainer } from "./container.ts";

describe("clock", () => {
  it("tells the current time and can be replaced", () => {
    const container = buildContainer({ port: 0, databaseUrl: "postgres://localhost/unused" });
    const before = Date.now();
    expect(container.cradle.clock.now().getTime()).toBeGreaterThanOrEqual(before);

    const fixed = new Date("2026-11-07T08:00:00Z");
    container.register({ clock: asValue({ now: () => fixed }) });
    expect(container.cradle.clock.now()).toBe(fixed);
  });
});
