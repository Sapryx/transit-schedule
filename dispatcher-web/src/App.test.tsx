import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderApp } from "./testing/renderApp.tsx";

describe("App", () => {
  it("shows the dispatcher panel title in English", () => {
    renderApp({ language: "en" });

    expect(screen.getByRole("heading", { name: "Transit Dispatcher" })).toBeInTheDocument();
  });

  it("shows the dispatcher panel title in Russian", () => {
    renderApp({ language: "ru" });

    expect(screen.getByRole("heading", { name: "Диспетчер транспорта" })).toBeInTheDocument();
  });

  it("uses the base language of a regional browser locale", () => {
    renderApp({ language: "ru-RU" });

    expect(screen.getByRole("heading", { name: "Диспетчер транспорта" })).toBeInTheDocument();
  });

  it("falls back to English for an unsupported language", () => {
    renderApp({ language: "de" });

    expect(screen.getByRole("heading", { name: "Transit Dispatcher" })).toBeInTheDocument();
  });
});
