import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router";
import { useDependencies } from "./DependenciesContext.tsx";

export function Layout() {
  const { t } = useTranslation();
  const { authStore } = useDependencies();
  return (
    <>
      <header>
        <h1>{t("app.title")}</h1>
        <nav>
          <NavLink to="/">{t("nav.home")}</NavLink>
        </nav>
        <button type="button" onClick={authStore.signOut}>
          {t("nav.signOut")}
        </button>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
