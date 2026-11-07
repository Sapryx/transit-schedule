import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useDependencies } from "./DependenciesContext.tsx";
import { modes, routeStates, states, type RouteSummary, type State } from "./routeModel.ts";

const byNumber = new Intl.Collator(undefined, { numeric: true });

export function RoutesPage() {
  const { t } = useTranslation();
  const { apiClient } = useDependencies();
  const [routes, setRoutes] = useState<RouteSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState("");
  const [state, setState] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    apiClient.request<RouteSummary[]>("GET", "/admin/routes").then(setRoutes, () => setFailed(true));
  }, [apiClient]);

  const query = search.trim().toLowerCase();
  const shown = (routes ?? [])
    .map((route) => ({ ...route, states: routeStates(route) }))
    .filter((route) => (!mode || route.mode === mode) && (!state || route.states.includes(state as State)) && route.number.toLowerCase().includes(query))
    .sort((a, b) => byNumber.compare(a.number, b.number));

  return (
    <section>
      <h2>{t("routes.heading")}</h2>
      <label>
        {t("routes.mode")}
        <select value={mode} onChange={(event) => setMode(event.target.value)}>
          <option value="">{t("routes.all")}</option>
          {modes.map((value) => (
            <option key={value} value={value}>
              {t(`routes.modes.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("routes.state")}
        <select value={state} onChange={(event) => setState(event.target.value)}>
          <option value="">{t("routes.all")}</option>
          {states.map((value) => (
            <option key={value} value={value}>
              {t(`routes.states.${value}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("routes.number")}
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      {failed && <p role="alert">{t("routes.failed")}</p>}
      {routes &&
        (shown.length === 0 ? (
          <p>{t("routes.empty")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("routes.number")}</th>
                <th>{t("routes.mode")}</th>
                <th>{t("routes.state")}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((route) => (
                <tr key={route.id}>
                  <td>
                    <Link to={`/routes/${route.id}`}>{route.number}</Link>
                  </td>
                  <td>{t(`routes.modes.${route.mode}`)}</td>
                  <td>{route.states.map((value) => t(`routes.states.${value}`)).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
    </section>
  );
}
