ALTER TABLE platforms
  DROP CONSTRAINT platforms_stop_id_fkey,
  ADD CONSTRAINT platforms_stop_id_fkey FOREIGN KEY (stop_id) REFERENCES stops ON DELETE CASCADE;

ALTER TABLE directions
  DROP CONSTRAINT directions_route_id_fkey,
  ADD CONSTRAINT directions_route_id_fkey FOREIGN KEY (route_id) REFERENCES routes ON DELETE CASCADE;

ALTER TABLE direction_platforms
  DROP CONSTRAINT direction_platforms_direction_id_fkey,
  ADD CONSTRAINT direction_platforms_direction_id_fkey FOREIGN KEY (direction_id) REFERENCES directions ON DELETE CASCADE;

ALTER TABLE departures
  DROP CONSTRAINT departures_direction_id_fkey,
  ADD CONSTRAINT departures_direction_id_fkey FOREIGN KEY (direction_id) REFERENCES directions ON DELETE CASCADE;
