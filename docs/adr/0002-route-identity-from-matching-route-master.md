# A route_master identifies a route only when it carries the same ref

OSM sync matches routes by OSM identity. The spec makes the route_master the route's identity, but Gomel data has
ref-less route_masters that group different lines by terminus (trolleybuses 2 and 8 under one master, 6 and 14 under
another). Taking such a master as the route would merge distinct numbered lines into one route without a number. So a
route relation belongs to its route_master's route only when the master's `ref` equals its own; otherwise it is
grouped with other relations of the same transport mode and ref, identified as `<mode>/<ref>`.
