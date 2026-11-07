import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { ApiError } from "./apiClient.ts";
import { DeleteButton, failureKey } from "./DeleteButton.tsx";
import { Departures } from "./Departures.tsx";
import { useDependencies } from "./DependenciesContext.tsx";
import { parseWholeMinutes } from "./minutes.ts";
import { dayTypes, directionStates, type DayType, localName, type DirectionDetail, type Name, type RouteSummary } from "./routeModel.ts";
import { TripTable } from "./TripTable.tsx";

const errorKeys: Record<string, string> = {
  invalid_travel_offsets: "route.invalidOffsets",
};

function Direction({
  direction,
  onSave,
  change,
}: {
  direction: DirectionDetail;
  onSave(path: string, body: unknown): Promise<void>;
  change(method: string, path: string): void;
}) {
  const { t, i18n } = useTranslation();
  const headingId = useId();
  const [offsets, setOffsets] = useState(() => direction.platforms.map((platform) => platform.travelOffset?.toString() ?? ""));
  const [dayType, setDayType] = useState<DayType>("weekday");
  const [message, setMessage] = useState<{ key: string; error: boolean } | null>(null);
  const local = (name: Name) => localName(name, i18n.resolvedLanguage);
  const { from, to, via } = direction.name;
  const title = via ? t("route.directionVia", { from: local(from), to: local(to), via: local(via) }) : t("route.direction", { from: local(from), to: local(to) });
  const refuse = (key: string) => setMessage({ key, error: true });

  async function save(path: string, body: unknown) {
    try {
      await onSave(`/admin/directions/${direction.id}/${path}`, body);
      setMessage({ key: "route.saved", error: false });
      return true;
    } catch (failure) {
      refuse((failure instanceof ApiError && errorKeys[failure.code]) || "routes.failed");
      return false;
    }
  }

  function saveOffsets() {
    const values = offsets.map((offset, index) => (index === 0 ? 0 : parseWholeMinutes(offset)));
    if (values.some((value, index) => value === null || (index > 0 && value < values[index - 1]!))) {
      refuse("route.invalidOffsets");
      return;
    }
    save("travel-offsets", values);
  }

  const changeDepartures = (list: number[]) => save("departures", { ...direction.departures, [dayType]: [...new Set(list)].sort((a, b) => a - b) });

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId}>{title}</h3>
      <p>{directionStates(direction).map((state) => t(`routes.states.${state}`)).join(", ")}</p>
      {message && <p role={message.error ? "alert" : "status"}>{t(message.key)}</p>}
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
                {index === 0 ? (
                  "0"
                ) : (
                  <>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      aria-label={t("route.offsetAt", { stop: local(platform.stopName) })}
                      value={offsets[index]}
                      onChange={(event) => setOffsets(offsets.map((offset, position) => (position === index ? event.target.value : offset)))}
                    />
                    {platform.interpolated && (
                      <>
                        {" "}
                        <mark>{t("route.interpolated")}</mark>
                      </>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={saveOffsets}>
        {t("route.saveOffsets")}
      </button>
      <label>
        {t("route.dayType")}
        <select value={dayType} onChange={(event) => setDayType(event.target.value as DayType)}>
          {dayTypes.map((type) => (
            <option key={type} value={type}>
              {t(`route.dayTypes.${type}`)}
            </option>
          ))}
        </select>
      </label>
      <Departures key={dayType} departures={direction.departures[dayType]} onChange={changeDepartures} onInvalid={refuse} />
      {direction.departures[dayType].length > 0 && (
        <TripTable
          stops={direction.platforms.map((platform, index) => ({ name: local(platform.stopName), travelOffset: index === 0 ? 0 : platform.travelOffset }))}
          departures={direction.departures[dayType]}
        />
      )}
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

  async function save(path: string, body: unknown) {
    await apiClient.request("PUT", path, body);
    await load();
  }

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
        <Direction key={direction.id} direction={direction} onSave={save} change={change} />
      ))}
    </section>
  );
}
