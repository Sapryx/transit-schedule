import { act, cleanup, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { apiServer } from "./testing/apiServer.ts";
import { renderApp } from "./testing/renderApp.tsx";

const locales = [
  {
    language: "en",
    signInHeading: "Sign in",
    login: "Login",
    password: "Password",
    submit: "Sign in",
    invalidCredentials: "Wrong login or password.",
    failed: "Could not sign in. Try again later.",
    home: "Home",
    signOut: "Sign out",
    welcome: "Choose a section in the navigation.",
  },
  {
    language: "ru",
    signInHeading: "Вход",
    login: "Логин",
    password: "Пароль",
    submit: "Войти",
    invalidCredentials: "Неверный логин или пароль.",
    failed: "Не удалось войти. Повторите попытку позже.",
    home: "Главная",
    signOut: "Выйти",
    welcome: "Выберите раздел в меню.",
  },
];

const validSession = { token: "valid-token", expiresAt: "2999-01-01T00:00:00.000Z" };

function acceptCredentials() {
  apiServer.use(
    http.post("http://localhost/api/auth/login", async ({ request }) => {
      const body = (await request.json()) as { login: string; password: string };
      if (body.login === "dispatcher" && body.password === "secret") {
        return HttpResponse.json(validSession);
      }
      return HttpResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }),
  );
}

describe.each(locales)("sign-in in $language", (text) => {
  it("leads to the authenticated layout with the configured credentials", async () => {
    acceptCredentials();
    const { user } = renderApp({ language: text.language });

    await user.type(screen.getByLabelText(text.login), "dispatcher");
    await user.type(screen.getByLabelText(text.password), "secret");
    await user.click(screen.getByRole("button", { name: text.submit }));

    expect(await screen.findByRole("button", { name: text.signOut })).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toHaveTextContent(text.home);
    expect(screen.getByText(text.welcome)).toBeInTheDocument();
  });

  it("shows an error for a wrong password", async () => {
    acceptCredentials();
    const { user } = renderApp({ language: text.language });

    await user.type(screen.getByLabelText(text.login), "dispatcher");
    await user.type(screen.getByLabelText(text.password), "wrong");
    await user.click(screen.getByRole("button", { name: text.submit }));

    expect(await screen.findByRole("alert")).toHaveTextContent(text.invalidCredentials);
    expect(screen.getByRole("heading", { name: text.signInHeading })).toBeInTheDocument();
  });

  it("shows an error when the server fails", async () => {
    apiServer.use(http.post("http://localhost/api/auth/login", () => new HttpResponse(null, { status: 500 })));
    const { user } = renderApp({ language: text.language });

    await user.type(screen.getByLabelText(text.login), "dispatcher");
    await user.type(screen.getByLabelText(text.password), "secret");
    await user.click(screen.getByRole("button", { name: text.submit }));

    expect(await screen.findByRole("alert")).toHaveTextContent(text.failed);
  });

  it("signs out and clears the session", async () => {
    localStorage.setItem("session", JSON.stringify(validSession));
    const { user } = renderApp({ language: text.language });

    await user.click(screen.getByRole("button", { name: text.signOut }));

    expect(screen.getByRole("heading", { name: text.signInHeading })).toBeInTheDocument();
    expect(localStorage.getItem("session")).toBeNull();
  });
});

describe("session", () => {
  it("survives a reload while valid", async () => {
    acceptCredentials();
    const { user } = renderApp();
    await user.type(screen.getByLabelText("Login"), "dispatcher");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("button", { name: "Sign out" });
    cleanup();

    renderApp();

    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("is dropped on reload once expired", () => {
    localStorage.setItem("session", JSON.stringify({ token: "old", expiresAt: "2000-01-01T00:00:00.000Z" }));

    renderApp();

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("is dropped on reload when the stored session is corrupt", () => {
    localStorage.setItem("session", "{not json");

    renderApp();

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("sends the token with API calls", async () => {
    localStorage.setItem("session", JSON.stringify(validSession));
    apiServer.use(
      http.get("http://localhost/api/admin/ping", ({ request }) =>
        HttpResponse.json({ authorization: request.headers.get("Authorization") }),
      ),
    );
    const { container } = renderApp();

    const response = await container.cradle.apiClient.request("GET", "/admin/ping");

    expect(response).toEqual({ authorization: "Bearer valid-token" });
  });

  it("returns to sign-in when an API call is refused", async () => {
    localStorage.setItem("session", JSON.stringify(validSession));
    apiServer.use(
      http.get("http://localhost/api/admin/ping", () => HttpResponse.json({ error: "unauthorized" }, { status: 401 })),
    );
    const { container } = renderApp();

    await act(() => expect(container.cradle.apiClient.request("GET", "/admin/ping")).rejects.toThrow("unauthorized"));

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(localStorage.getItem("session")).toBeNull();
  });
});
