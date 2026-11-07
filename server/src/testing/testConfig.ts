import type { Config } from "../config.ts";

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    port: 0,
    databaseUrl: "postgres://localhost/unused",
    dispatcherLogin: "dispatcher",
    dispatcherPassword: "secret",
    jwtSecret: "test-jwt-secret",
    ...overrides,
  };
}
