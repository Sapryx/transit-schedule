import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DeleteButton, failureKey } from "./DeleteButton.tsx";
import { useDependencies } from "./DependenciesContext.tsx";
import type { Name } from "./routeModel.ts";

interface Stop {
  id: number;
  name: Name;
  missingFromOsm: boolean;
}

export function StopsPage() {
  const { t, i18n } = useTranslation();
  const { apiClient } = useDependencies();
  const [stops, setStops] = useState<Stop[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const changeAndReload = useCallback(
    async (action: () => Promise<unknown>) => {
      try {
        await action();
        setError(null);
        setStops(await apiClient.request<Stop[]>("GET", "/admin/stops"));
      } catch (failure) {
        setError(failureKey(failure));
      }
    },
    [apiClient],
  );

  useEffect(() => {
    changeAndReload(async () => {});
  }, [changeAndReload]);

  const local = (name: Name) => (i18n.resolvedLanguage === "ru" ? name.ru : name.en);

  return (
    <section>
      <h2>{t("stops.heading")}</h2>
      <p>{t("route.osmHint")}</p>
      {error && <p role="alert">{t(error)}</p>}
      {stops && (
        <table>
          <thead>
            <tr>
              <th>{t("stops.name")}</th>
              <th>{t("stops.state")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {stops.map((stop) => (
              <tr key={stop.id}>
                <td>{local(stop.name)}</td>
                <td>{t(stop.missingFromOsm ? "stops.missing" : "stops.inOsm")}</td>
                <td>
                  {stop.missingFromOsm && (
                    <DeleteButton label={t("stops.delete")} onDelete={() => changeAndReload(() => apiClient.request("DELETE", `/admin/stops/${stop.id}`))} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
