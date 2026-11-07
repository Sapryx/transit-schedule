import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App.tsx";
import { buildContainer } from "./container.ts";
import { DependenciesProvider } from "./DependenciesContext.tsx";

const container = buildContainer({ apiBaseUrl: "/api", language: navigator.language });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DependenciesProvider container={container}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </DependenciesProvider>
  </StrictMode>,
);
