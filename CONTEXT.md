# Transit Schedule

Public transport of Gomel as seen by passengers and maintained by a dispatcher: routes, the stops they serve
and when vehicles arrive.

## Network

**Route**:
A numbered public transport line of one transport mode, e.g. bus 1. Owns its directions and their schedules.
_Avoid_: Line, service

**Transport mode**:
The kind of vehicle serving a route: bus or trolleybus.
_Avoid_: Transport type, vehicle type

**Direction**:
One way of travelling along a route, e.g. "Vokzal → Lyubensky", with its own ordered sequence of platforms and
its path along the streets. A route usually has two directions; a circular route has one, and a route with
variants (e.g. a detour via the market) has one direction per variant. A direction is named after its first and
last stops, "Vokzal → Lyubensky", adding "via …" when variants share both ends.
_Avoid_: Variant, way

**Stop**:
A named place where passengers board and leave vehicles, e.g. "Vokzal", made of one or more platforms.
A stop owns no schedule: it shows the routes whose directions pass through its platforms and their arrival
times there. Passengers choose stops, never platforms.
_Avoid_: Station, halt, stop area

**Platform**:
One boarding point of a stop with its own position, usually one side of a street. Directions pass through
platforms; a platform belongs to exactly one stop.
_Avoid_: Stop position, pole, side

**Stop name**:
A stop's name in Russian and in English. The English name comes from OSM when OSM has one; otherwise it starts
as a Latin transliteration of the Russian name and the dispatcher may correct it.
_Avoid_: Title, label

## Schedule

**Departure**:
A time at which a vehicle leaves the first stop of a direction on a given day type. A direction has its own
list of departures for weekdays and for weekends.
_Avoid_: Start time, dispatch

**Travel offset**:
The number of minutes from a departure until the vehicle arrives at a given platform of the direction; the
first platform has offset 0. Each platform in a direction has exactly one travel offset, the same for every
departure.
_Avoid_: Delay, duration, interval

**Trip**:
One run of a vehicle along a direction on a given date: a departure together with the arrival times it yields
at every platform (departure plus travel offset). Trips are derived, never entered.
_Avoid_: Run, journey, voyage

**Arrival time**:
When a trip reaches a platform. It belongs to the date of its departure, so a trip leaving at 23:50 arrives at
24:20 of that date rather than at 00:20 of the next.
_Avoid_: Stop time, passing time

**Scheduled direction**:
A direction that has at least one departure and a travel offset for every platform. Passengers see only
scheduled directions of routes in service, and only the stops such directions pass through.
_Avoid_: Active, published, complete

**Upcoming arrivals**:
The next arrival times at a stop across all routes passing through it, soonest first, e.g. "1 → Lyubensky in 4 min".
_Avoid_: Departures board, next buses

## Trip planning

**Journey**:
A way to get from one stop to another starting no earlier than a requested date and time: a chain of one
to three trips joined by transfers. Up to five journeys starting within two hours are offered, each only if no
other journey departs no earlier, arrives no later and has no more transfers.
_Avoid_: Route (a route is a line, not a passenger's path), itinerary, connection

**Leg**:
The part of a journey spent on one trip: the route and direction, the boarding stop with its departure and the
alighting stop with its arrival.
_Avoid_: Segment, section, hop

**Transfer**:
Leaving one trip and boarding another at the same stop, possibly at a different platform; the next trip must
arrive at least 2 minutes and at most an hour after the first one does. A journey has at most two
transfers.
_Avoid_: Change, connection

## Passenger

**Favourite**:
A stop or a whole route a passenger has marked on their device for quick access. A favourite whose stop or route
no longer exists stays listed as unavailable until the passenger removes it.
_Avoid_: Bookmark, saved item

## Data sources

**OSM sync**:
Bringing the network (stops, platforms, routes, directions, their platform sequences and paths) in line with
OpenStreetMap, matching objects by their OSM identity. Only city buses and trolleybuses with a route number are
synced. The network has no other source: a missing route or stop is added to OpenStreetMap and then synced.
Schedules never come from OSM.
_Avoid_: Import, update, scrape

**OSM-sourced**:
What OSM provides for a network object (names, positions, platform sequences, paths). The dispatcher cannot
change it; corrections are made in OpenStreetMap itself.
_Avoid_: Imported, external

**Withdrawn route**:
A route the dispatcher has taken out of service: passengers do not see it and journeys do not use it, but its
schedule is kept so it can be returned to service.
_Avoid_: Disabled, hidden, archived

**Needs review**:
The state of a direction whose platform sequence OSM sync changed: existing travel offsets and departures are
kept, a new platform gets an offset halfway between its neighbours, and the dispatcher should confirm them.
The direction stays visible to passengers.
_Avoid_: Dirty, invalid, pending

**Missing from OSM**:
The state of an OSM-sourced object that OSM sync no longer finds. It stays in service, with its schedule, until
the dispatcher deletes it.
_Avoid_: Deleted, orphaned, stale

## Calendar

**Day type**:
Whether a date runs the weekday or the weekend schedule. Monday to Friday are weekdays, Saturday and Sunday
are weekends, and every holiday is a weekend.
_Avoid_: Service day, calendar

**Holiday**:
A date the dispatcher marks as running the weekend schedule. The list starts with the public holidays of Belarus
for the current and next year and is maintained by the dispatcher.
_Avoid_: Day off, exception

Passengers plan journeys for a date and time, whose day type follows from the calendar; a stop's schedule is
viewed per day type, defaulting to today's.
