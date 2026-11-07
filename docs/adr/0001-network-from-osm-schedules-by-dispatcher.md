# Network comes from OpenStreetMap, schedules come from the dispatcher

No open source publishes Gomel timetables: Yandex receives them from the operator under contract, and gomeltrans.net
is behind a bot challenge. OpenStreetMap, however, maps every city route with ordered platforms. So OSM is the only source of
the network: stops, platforms, routes and directions are synced from OSM by OSM identity and are read-only in the
dispatcher panel, and a missing or wrong object is fixed in OpenStreetMap and synced again. The dispatcher enters
departures, travel offsets and holidays, corrects English stop names OSM lacks, withdraws routes from service and
deletes objects missing from OSM. This is how the panel covers "add, edit and delete routes and stops" from the
assignment. Sync runs when the network is empty and on demand; it never deletes objects that disappear from OSM
and never drops schedules.

## Considered Options

- Hand-written seed data: no automation, the network goes stale.
- Scraping gomeltrans.net: would bypass bot protection.
- Dispatcher-created routes and stops alongside OSM ones: two sources of truth for the same network.
- Letting the dispatcher edit OSM-sourced fields with per-field locks: makes every sync a merge.

## Consequences

The schedule import source is still open, so schedule entry must stay a replaceable module behind the same
travel offset and departure model.
