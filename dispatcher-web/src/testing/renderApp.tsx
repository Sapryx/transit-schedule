import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { App } from "../App.tsx";
import { buildContainer } from "../container.ts";
import { DependenciesProvider } from "../DependenciesContext.tsx";

export function renderApp({ language = "en", path = "/" }: { language?: string; path?: string } = {}) {
  const container = buildContainer({ apiBaseUrl: "http://localhost/api", language });
  const user = userEvent.setup();
  render(
    <DependenciesProvider container={container}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </DependenciesProvider>,
  );
  return { container, user };
}
