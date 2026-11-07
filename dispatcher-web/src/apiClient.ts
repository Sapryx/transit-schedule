import type { AuthStore } from "./authStore.ts";
import type { Config } from "./container.ts";

export class ApiError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export interface ApiClient {
  request<T>(method: string, path: string, body?: unknown): Promise<T>;
}

export function createApiClient({ config, authStore }: { config: Config; authStore: AuthStore }): ApiClient {
  return {
    async request(method, path, body) {
      const token = authStore.session()?.token;
      const response = await fetch(`${config.apiBaseUrl}${path}`, {
        method,
        headers: {
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 401) {
        authStore.signOut();
      }
      if (!response.ok) {
        throw new ApiError(data?.error ?? `http_${response.status}`);
      }
      return data;
    },
  };
}
