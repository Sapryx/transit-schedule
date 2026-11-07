# Transit Schedule

Client-server application for a public transport schedule (Gomel), deployed with Docker Compose.
Coursework project for the "Cloud Technologies of Data Analysis" course, Sukhoi State Technical University of Gomel.
The apps support English and Russian.

## Requirements

Passenger — Android app, no registration:

- R1 list of routes (bus, trolleybus) and their stops;
- R2 schedule of a selected stop, weekdays and weekends, with upcoming arrivals;
- R3 journey search between two stops for a date and time, with up to 2 transfers;
- R4 stops and routes on an OpenStreetMap map;
- R5 favourite stops and routes stored on the device; the app works online only.

Dispatcher — web panel with authorization:

- R6 sign-in with a single account whose login and password come from compose environment variables
  (12-hour session);
- R7 manage schedules (departures, travel offsets) and holidays, withdraw routes from service, correct English
  stop names, delete objects missing from OSM, run OSM sync; a map shows stops and their trips.

Data:

- R8 the network (stops, platforms, routes, directions) comes only from OpenStreetMap (Overpass API) and is
  read-only in the panel; see `docs/adr/0001-network-from-osm-schedules-by-dispatcher.md`;
- R9 schedules are entered manually in the panel for now; a schedule import source will be chosen later,
  so schedule entry is a replaceable module.

Domain language: `CONTEXT.md`.

Server and deployment:

- R10 REST API (JSON), PostgreSQL;
- R11 server, database and dispatcher panel run in separate Docker containers started with one command.

## Stack

| Part | Technology | Tests |
|---|---|---|
| `server/` | Node.js 26 + TypeScript (run directly, no build), Express, PostgreSQL, Awilix | Vitest, supertest |
| `dispatcher-web/` | React + Vite + TypeScript, Leaflet, Awilix; served by nginx | Vitest, React Testing Library |
| `android/` | Kotlin, Jetpack Compose, osmdroid, DataStore, Hilt | JUnit 4, Robolectric, Compose UI test, MockK, coroutines-test |
| Deployment | Docker, Docker Compose | — |

## Run

```bash
docker compose up -d --build
```

- server: http://localhost:3000/health
- dispatcher panel: http://localhost:8088 (API proxied at `/api`)

Environment variables (optional, defaults in `docker-compose.yml`): `DB_PASSWORD`, `DISPATCHER_LOGIN`,
`DISPATCHER_PASSWORD`, `JWT_SECRET`; the server refuses to start when any of the last three is empty.

## Develop

```bash
cd server && npm install && npm test
cd dispatcher-web && npm install && npm test && npm run dev
cd android && ./gradlew test assembleDebug
```

Server tests start PostgreSQL with Testcontainers, so Docker must be running. The server applies the SQL files
in `server/migrations/` at startup in name order (`0001_create_routes.sql`, `0002_…`); each file runs once.
