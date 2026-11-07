import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "./apiClient.ts";
import { useDependencies } from "./DependenciesContext.tsx";

interface Count {
  created: number;
  updated: number;
  missing: number;
}

const kinds = ["stops", "platforms", "routes", "directions"] as const;

type SyncReport = Record<(typeof kinds)[number], Count> & {
  needsReview: number[];
  skippedRoutes: { ref: string | null; reason: "no_ref" | "regional" | "national" | "international" | "no_platforms" }[];
};

const errorKeys: Record<string, string> = {
  sync_in_progress: "osmSync.inProgress",
  overpass_unavailable: "osmSync.unavailable",
};

export function OsmSyncPage() {
  const { t } = useTranslation();
  const { apiClient } = useDependencies();
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<SyncReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reviewId = useId();
  const skippedId = useId();

  async function start() {
    setRunning(true);
    setError(null);
    setReport(null);
    try {
      setReport(await apiClient.request<SyncReport>("POST", "/admin/osm-sync"));
    } catch (failure) {
      setError((failure instanceof ApiError && errorKeys[failure.code]) || "osmSync.failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section>
      <h2>{t("osmSync.heading")}</h2>
      <button type="button" onClick={start} disabled={running}>
        {t("osmSync.start")}
      </button>
      {running && <p role="status">{t("osmSync.running")}</p>}
      {error && <p role="alert">{t(error)}</p>}
      {report && (
        <>
          <table>
            <thead>
              <tr>
                <th>{t("osmSync.kind")}</th>
                <th>{t("osmSync.created")}</th>
                <th>{t("osmSync.updated")}</th>
                <th>{t("osmSync.missing")}</th>
              </tr>
            </thead>
            <tbody>
              {kinds.map((kind) => (
                <tr key={kind}>
                  <th scope="row">{t(`osmSync.kinds.${kind}`)}</th>
                  <td>{report[kind].created}</td>
                  <td>{report[kind].updated}</td>
                  <td>{report[kind].missing}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 id={reviewId}>{t("osmSync.needsReview")}</h3>
          {report.needsReview.length === 0 ? (
            <p>{t("osmSync.noReview")}</p>
          ) : (
            <ul aria-labelledby={reviewId}>
              {report.needsReview.map((id) => (
                <li key={id}>{id}</li>
              ))}
            </ul>
          )}
          <h3 id={skippedId}>{t("osmSync.skipped")}</h3>
          <ul aria-labelledby={skippedId}>
            {report.skippedRoutes.map((route) => (
              <li key={`${route.ref}-${route.reason}`}>
                {t("osmSync.skippedRoute", { ref: route.ref ?? t("osmSync.noNumber"), reason: t(`osmSync.reasons.${route.reason}`) })}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
