import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "./apiClient.ts";
import type { Session } from "./authStore.ts";
import { useDependencies } from "./DependenciesContext.tsx";

export function SignInPage() {
  const { t } = useTranslation();
  const { apiClient, authStore } = useDependencies();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      authStore.signIn(await apiClient.request<Session>("POST", "/auth/login", { login, password }));
    } catch (failure) {
      const invalid = failure instanceof ApiError && failure.code === "invalid_credentials";
      setError(invalid ? "signIn.invalidCredentials" : "signIn.failed");
    }
  }

  return (
    <main>
      <h1>{t("app.title")}</h1>
      <h2>{t("signIn.heading")}</h2>
      <form onSubmit={submit}>
        <label>
          {t("signIn.login")}
          <input value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" />
        </label>
        <label>
          {t("signIn.password")}
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <p role="alert">{t(error)}</p>}
        <button type="submit">{t("signIn.submit")}</button>
      </form>
    </main>
  );
}
