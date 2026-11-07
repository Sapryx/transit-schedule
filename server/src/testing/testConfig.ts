import type { Config } from "../config.ts";

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    port: 0,
    databaseUrl: "postgres://localhost/unused",
    dispatcherLogin: "dispatcher",
    dispatcherPassword: "secret",
    jwtSecret: "test-jwt-secret",
    overpassUrl: "http://127.0.0.1:1/api/interpreter",
    ...overrides,
  };
}
