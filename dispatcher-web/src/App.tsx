import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes } from "react-router";
import { useDependencies } from "./DependenciesContext.tsx";
import { Layout } from "./Layout.tsx";
import { SignInPage } from "./SignInPage.tsx";

function HomePage() {
  const { t } = useTranslation();
  return <p>{t("home.welcome")}</p>;
}

export function App() {
  const { authStore } = useDependencies();
  const session = useSyncExternalStore(authStore.subscribe, authStore.session);

  if (!session) {
    return (
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="*" element={<Navigate to="/sign-in" replace />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
