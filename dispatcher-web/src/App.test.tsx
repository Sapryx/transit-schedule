import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App.tsx";
import { buildContainer } from "./container.ts";
import { DependenciesProvider } from "./DependenciesContext.tsx";

function renderApp(language: string) {
  const container = buildContainer({ apiBaseUrl: "/api", language });
  render(
    <DependenciesProvider container={container}>
      <App />
    </DependenciesProvider>,
  );
}

describe("App", () => {
  it("shows the dispatcher panel title in English", () => {
    renderApp("en");

    expect(screen.getByRole("heading", { name: "Transit Dispatcher" })).toBeInTheDocument();
  });

  it("shows the dispatcher panel title in Russian", () => {
    renderApp("ru");

    expect(screen.getByRole("heading", { name: "Диспетчер транспорта" })).toBeInTheDocument();
  });

  it("uses the base language of a regional browser locale", () => {
    renderApp("ru-RU");

    expect(screen.getByRole("heading", { name: "Диспетчер транспорта" })).toBeInTheDocument();
  });

  it("falls back to English for an unsupported language", () => {
    renderApp("de");

    expect(screen.getByRole("heading", { name: "Transit Dispatcher" })).toBeInTheDocument();
  });
});
