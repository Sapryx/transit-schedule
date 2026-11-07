import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { apiServer } from "./testing/apiServer.ts";

beforeAll(() => apiServer.listen({ onUnhandledFrame: "error" }));

afterEach(() => {
  cleanup();
  apiServer.resetHandlers();
  localStorage.clear();
});

afterAll(() => apiServer.close());
