import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "./apiClient.ts";
import { useDependencies } from "./DependenciesContext.tsx";

interface Holiday {
  date: string;
}

const errorKeys: Record<string, string> = {
  duplicate_date: "holidays.duplicate",
  invalid_date: "holidays.invalid",
};

export function HolidaysPage() {
  const { t, i18n } = useTranslation();
  const { apiClient } = useDependencies();
  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (action: () => Promise<unknown>) => {
    try {
      await action();
      setError(null);
      setHolidays(await apiClient.request<Holiday[]>("GET", `/admin/holidays${showPast ? "?past=true" : ""}`));
    } catch (failure) {
      setError((failure instanceof ApiError && errorKeys[failure.code]) || "holidays.failed");
    }
  }, [apiClient, showPast]);

  useEffect(() => {
    run(async () => {});
  }, [run]);

  function add(event: FormEvent) {
    event.preventDefault();
    run(() => apiClient.request("POST", "/admin/holidays", { date }));
  }

  const format = new Intl.DateTimeFormat(i18n.language, { dateStyle: "long", timeZone: "UTC" });

  return (
    <section>
      <h2>{t("holidays.heading")}</h2>
      <label>
        <input type="checkbox" checked={showPast} onChange={(event) => setShowPast(event.target.checked)} />
        {t("holidays.showPast")}
      </label>
      <form onSubmit={add}>
        <label>
          {t("holidays.date")}
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </label>
        <button type="submit">{t("holidays.add")}</button>
      </form>
      {error && <p role="alert">{t(error)}</p>}
      {holidays?.length === 0 && <p>{t("holidays.empty")}</p>}
      <ul>
        {holidays?.map((holiday) => (
          <li key={holiday.date}>
            {format.format(new Date(`${holiday.date}T00:00:00.000Z`))}{" "}
            <button type="button" onClick={() => run(() => apiClient.request("DELETE", `/admin/holidays/${holiday.date}`))}>
              {t("holidays.remove")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
