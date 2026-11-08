export interface Name {
  ru: string;
  en: string;
}

export interface DirectionName {
  from: Name;
  to: Name;
  via: Name | null;
}

export const stopName = (stop: string) => `json_build_object('ru', ${stop}.name_ru, 'en', ${stop}.name_en)`;

const endStop = (order: "ASC" | "DESC") => `(
  SELECT ${stopName("s")} FROM direction_platforms dp JOIN platforms p ON p.id = dp.platform_id JOIN stops s ON s.id = p.stop_id
  WHERE dp.direction_id = d.id ORDER BY dp.position ${order} LIMIT 1)`;

export const directionName = `json_build_object('from', ${endStop("ASC")}, 'to', ${endStop("DESC")}, 'via', (SELECT ${stopName("v")} FROM stops v WHERE v.id = d.via_stop_id))`;

export const isScheduled = `EXISTS (SELECT FROM departures WHERE direction_id = d.id)
    AND NOT EXISTS (SELECT FROM direction_platforms WHERE direction_id = d.id AND travel_offset IS NULL)`;

export const directionPlatforms = (fields: string) => `(
    SELECT json_agg(json_build_object(${fields}) ORDER BY dp.position)
    FROM direction_platforms dp JOIN platforms p ON p.id = dp.platform_id JOIN stops s ON s.id = p.stop_id
    WHERE dp.direction_id = d.id)`;
