import { createContext, useContext, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import type { AppContainer, Cradle } from "./container.ts";

const DependenciesContext = createContext<AppContainer | null>(null);

export function DependenciesProvider({ container, children }: { container: AppContainer; children: ReactNode }) {
  return (
    <DependenciesContext.Provider value={container}>
      <I18nextProvider i18n={container.cradle.i18n}>{children}</I18nextProvider>
    </DependenciesContext.Provider>
  );
}

export function useDependencies(): Cradle {
  const container = useContext(DependenciesContext);
  if (!container) {
    throw new Error("DependenciesProvider is missing");
  }
  return container.cradle;
}
