import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { formatTime, parseTime, parseWholeMinutes } from "./minutes.ts";

interface Props {
  departures: number[];
  onChange(departures: number[]): Promise<boolean>;
  onInvalid(key: string): void;
}

export function Departures({ departures, onChange, onInvalid }: Props) {
  const { t } = useTranslation();
  const [time, setTime] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [every, setEvery] = useState("");

  function refusal(minutes: number | null) {
    if (minutes === null) {
      return "route.invalidTime";
    }
    return departures.includes(minutes) ? "route.duplicateDeparture" : null;
  }

  function edit(index: number, text: string) {
    const minutes = parseTime(text);
    if (minutes === departures[index]) {
      return;
    }
    const key = refusal(minutes);
    if (key) {
      onInvalid(key);
    } else {
      onChange(departures.map((departure, position) => (position === index ? minutes! : departure)));
    }
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    const minutes = parseTime(time);
    const key = refusal(minutes);
    if (key) {
      onInvalid(key);
    } else if (await onChange([...departures, minutes!])) {
      setTime("");
    }
  }

  function addSeries(event: FormEvent) {
    event.preventDefault();
    const [start, end, step] = [parseTime(from), parseTime(to), parseWholeMinutes(every)];
    if (start === null || end === null || !step || end < start) {
      onInvalid("route.invalidSeries");
      return;
    }
    onChange([...departures, ...Array.from({ length: Math.floor((end - start) / step) + 1 }, (_, index) => start + index * step)]);
  }

  return (
    <>
      <h4>{t("route.departures")}</h4>
      {departures.length === 0 ? (
        <p>{t("route.noDepartures")}</p>
      ) : (
        <ul aria-label={t("route.departures")}>
          {departures.map((minutes, index) => (
            <li key={minutes}>
              <input
                aria-label={t("route.departureAt", { time: formatTime(minutes) })}
                defaultValue={formatTime(minutes)}
                onBlur={(event) => edit(index, event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
              />
              <button type="button" aria-label={t("route.removeDeparture", { time: formatTime(minutes) })} onClick={() => onChange(departures.filter((_, position) => position !== index))}>
                {t("route.remove")}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add}>
        <label>
          {t("route.newDeparture")}
          <input value={time} onChange={(event) => setTime(event.target.value)} placeholder="06:00" />
        </label>
        <button type="submit">{t("route.add")}</button>
      </form>
      <form onSubmit={addSeries}>
        <label>
          {t("route.from")}
          <input value={from} onChange={(event) => setFrom(event.target.value)} placeholder="06:00" />
        </label>
        <label>
          {t("route.to")}
          <input value={to} onChange={(event) => setTo(event.target.value)} placeholder="22:00" />
        </label>
        <label>
          {t("route.every")}
          <input type="number" step={1} value={every} onChange={(event) => setEvery(event.target.value)} />
        </label>
        <button type="submit">{t("route.addSeries")}</button>
      </form>
    </>
  );
}
