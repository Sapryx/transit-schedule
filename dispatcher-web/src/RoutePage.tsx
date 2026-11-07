import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { ApiError } from "./apiClient.ts";
import { useDependencies } from "./DependenciesContext.tsx";
import { directionStates, type DirectionDetail, type Name, type RouteSummary } from "./routeModel.ts";

function Direction({ direction }: { direction: DirectionDetail }) {
  const { t, i18n } = useTranslation();
  const headingId = useId();
  const local = (name: Name) => (i18n.resolvedLanguage === "ru" ? name.ru : name.en);
  const { from, to, via } = direction.name;
  const title = via ? t("route.directionVia", { from: local(from), to: local(to), via: local(via) }) : t("route.direction", { from: local(from), to: local(to) });

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId}>{title}</h3>
      <p>{directionStates(direction).map((state) => t(`routes.states.${state}`)).join(", ")}</p>
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
              <td>{platform.travelOffset ?? "—"}</td>
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
  const [route, setRoute] = useState<RouteSummary<DirectionDetail> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .request<RouteSummary<DirectionDetail>>("GET", `/admin/routes/${id}`)
      .then(setRoute, (failure) => setError(failure instanceof ApiError && failure.code === "not_found" ? "route.notFound" : "routes.failed"));
  }, [apiClient, id]);

  if (error) {
    return <p role="alert">{t(error)}</p>;
  }
  if (!route) {
    return null;
  }
  return (
    <section>
      <h2>{t("route.heading", { mode: t(`routes.modes.${route.mode}`), number: route.number })}</h2>
      <p>{t("route.osmHint")}</p>
      {route.directions.map((direction) => (
        <Direction key={direction.id} direction={direction} />
      ))}
    </section>
  );
}
