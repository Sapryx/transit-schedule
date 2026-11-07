CREATE TABLE stops (
  id serial PRIMARY KEY,
  osm_id text NOT NULL UNIQUE,
  name_ru text NOT NULL,
  name_en text NOT NULL
);

CREATE TABLE platforms (
  id serial PRIMARY KEY,
  osm_id text NOT NULL UNIQUE,
  stop_id integer NOT NULL REFERENCES stops,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL
);

CREATE TABLE routes (
  id serial PRIMARY KEY,
  osm_id text NOT NULL UNIQUE,
  number text NOT NULL,
  transport_mode text NOT NULL CHECK (transport_mode IN ('bus', 'trolleybus'))
);

CREATE TABLE directions (
  id serial PRIMARY KEY,
  osm_id text NOT NULL UNIQUE,
  route_id integer NOT NULL REFERENCES routes,
  via_stop_id integer REFERENCES stops,
  path jsonb NOT NULL
);

CREATE TABLE direction_platforms (
  direction_id integer NOT NULL REFERENCES directions,
  position integer NOT NULL,
  platform_id integer NOT NULL REFERENCES platforms,
  PRIMARY KEY (direction_id, position)
);
