ALTER TABLE stops ADD COLUMN missing_from_osm boolean NOT NULL DEFAULT false;

ALTER TABLE platforms ADD COLUMN missing_from_osm boolean NOT NULL DEFAULT false;

ALTER TABLE routes ADD COLUMN missing_from_osm boolean NOT NULL DEFAULT false;

ALTER TABLE directions
  ADD COLUMN missing_from_osm boolean NOT NULL DEFAULT false,
  ADD COLUMN needs_review boolean NOT NULL DEFAULT false;

ALTER TABLE direction_platforms ADD COLUMN travel_offset integer;

CREATE TABLE departures (
  direction_id integer NOT NULL REFERENCES directions,
  day_type text NOT NULL CHECK (day_type IN ('weekday', 'weekend')),
  minutes integer NOT NULL,
  PRIMARY KEY (direction_id, day_type, minutes)
);
