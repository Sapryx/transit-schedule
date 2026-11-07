import { describe, expect, it } from "vitest";
import { readConfig } from "./config.ts";

const env = {
  PORT: "4000",
  DISPATCHER_LOGIN: "dispatcher",
  DISPATCHER_PASSWORD: "secret",
  JWT_SECRET: "jwt-secret",
};

describe("readConfig", () => {
  it("reads the server settings from the environment", () => {
    expect(readConfig(env)).toEqual({
      port: 4000,
      dispatcherLogin: "dispatcher",
      dispatcherPassword: "secret",
      jwtSecret: "jwt-secret",
    });
  });

  it("defaults the port to 3000", () => {
    expect(readConfig({ ...env, PORT: undefined }).port).toBe(3000);
  });

  it.each(["DISPATCHER_LOGIN", "DISPATCHER_PASSWORD", "JWT_SECRET"])("refuses an empty %s", (name) => {
    expect(() => readConfig({ ...env, [name]: "" })).toThrow(`${name} must be set`);
    expect(() => readConfig({ ...env, [name]: undefined })).toThrow(`${name} must be set`);
  });
});
