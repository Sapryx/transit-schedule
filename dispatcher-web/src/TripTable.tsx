import { useTranslation } from "react-i18next";
import { formatTime } from "./minutes.ts";

interface Props {
  stops: { name: string; travelOffset: number | null }[];
  departures: number[];
}

export function TripTable({ stops, departures }: Props) {
  const { t } = useTranslation();

  return (
    <table>
      <caption>{t("route.trips")}</caption>
      <thead>
        <tr>
          <th>{t("route.stop")}</th>
          {departures.map((departure) => (
            <th key={departure}>{formatTime(departure)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {stops.map((stop, index) => (
          <tr key={index}>
            <td>{stop.name}</td>
            {departures.map((departure) => (
              <td key={departure}>{stop.travelOffset === null ? "—" : formatTime(departure + stop.travelOffset)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
