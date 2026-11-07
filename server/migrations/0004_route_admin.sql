ALTER TABLE routes ADD COLUMN withdrawn boolean NOT NULL DEFAULT false;

ALTER TABLE direction_platforms ADD COLUMN interpolated boolean NOT NULL DEFAULT false;
