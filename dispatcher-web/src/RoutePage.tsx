import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { ApiError } from "./apiClient.ts";
import { DeleteButton, failureKey } from "./DeleteButton.tsx";
import { useDependencies } from "./DependenciesContext.tsx";
import { directionStates, localName, type DirectionDetail, type Name, type RouteSummary } from "./routeModel.ts";

function Direction({ direction, change }: { direction: DirectionDetail; change: (method: string, path: string) => void }) {
  const { t, i18n } = useTranslation();
  const headingId = useId();
  const local = (name: Name) => localName(name, i18n.resolvedLanguage);
  const { from, to, via } = direction.name;
  const title = via ? t("route.directionVia", { from: local(from), to: local(to), via: local(via) }) : t("route.direction", { from: local(from), to: local(to) });

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId}>{title}</h3>
      <p>{directionStates(direction).map((state) => t(`routes.states.${state}`)).join(", ")}</p>
      {direction.needsReview && (
        <p>
          {t("route.review")}{" "}
          <button type="button" onClick={() => change("POST", `/admin/directions/${direction.id}/review`)}>
            {t("route.confirmReview")}
          </button>
        </p>
      )}
      {direction.missingFromOsm && <DeleteButton label={t("route.deleteDirection")} onDelete={() => change("DELETE", `/admin/directions/${direction.id}`)} />}
      <table aria-labelledby={headingId}>
        <thead>
          <tr>
            <th>#</th>
            <th>{t("route.stop")}</th>
            <th>{t("route.travelOffset")}</th>
          </tr>
        </thead>
        <tbody>
          {direction.platforms.map((platform, index) => (
            <tr key={index}>
              <td>{index + 1}</td>
              <td>{local(platform.stopName)}</td>
              <td>
                {platform.interpolated ? (
                  <>
                    <mark>{platform.travelOffset}</mark> {t("route.interpolated")}
                  </>
                ) : (
                  (platform.travelOffset ?? "—")
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function RoutePage() {
  const { t } = useTranslation();
  const { apiClient } = useDependencies();
  const { id } = useParams();
  const navigate = useNavigate();
  const [route, setRoute] = useState<RouteSummary<DirectionDetail> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      apiClient
        .request<RouteSummary<DirectionDetail>>("GET", `/admin/routes/${id}`)
        .then(setRoute, (failure) => setError(failure instanceof ApiError && failure.code === "not_found" ? "route.notFound" : "routes.failed")),
    [apiClient, id],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function change(method: string, path: string, body?: unknown) {
    try {
      await apiClient.request(method, path, body);
      setError(null);
      await load();
    } catch (failure) {
      setError(failureKey(failure));
    }
  }

  async function deleteRoute() {
    try {
      await apiClient.request("DELETE", `/admin/routes/${id}`);
      navigate("/routes");
    } catch (failure) {
      setError(failureKey(failure));
    }
  }

  if (!route) {
    return error && <p role="alert">{t(error)}</p>;
  }
  return (
    <section>
      <h2>{t("route.heading", { mode: t(`routes.modes.${route.mode}`), number: route.number })}</h2>
      {error && <p role="alert">{t(error)}</p>}
      <p>{t("route.osmHint")}</p>
      <label>
        <input type="checkbox" checked={route.withdrawn} onChange={(event) => change("PATCH", `/admin/routes/${route.id}`, { withdrawn: event.target.checked })} />
        {t("route.withdrawn")}
      </label>
      {route.missingFromOsm && <DeleteButton label={t("route.deleteRoute")} onDelete={deleteRoute} />}
      {route.directions.map((direction) => (
        <Direction key={direction.id} direction={direction} change={change} />
      ))}
    </section>
  );
}
