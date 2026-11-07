import { asFunction, asValue, createContainer, InjectionMode } from "awilix";
import type { i18n } from "i18next";
import { createApiClient, type ApiClient } from "./apiClient.ts";
import { createAuthStore, type AuthStore } from "./authStore.ts";
import type { Config } from "./config.ts";
import { createI18n } from "./i18n.ts";

export interface Cradle {
  config: Config;
  i18n: i18n;
  storage: Storage;
  authStore: AuthStore;
  apiClient: ApiClient;
}

export function buildContainer(config: Config) {
  const container = createContainer<Cradle>({ injectionMode: InjectionMode.PROXY, strict: true });
  container.register({
    config: asValue(config),
    i18n: asFunction(({ config }: Cradle) => createI18n(config.language)).singleton(),
    storage: asValue(localStorage),
    authStore: asFunction(createAuthStore).singleton(),
    apiClient: asFunction(createApiClient).singleton(),
  });
  return container;
}

export type AppContainer = ReturnType<typeof buildContainer>;
