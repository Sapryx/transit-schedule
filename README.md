# Transit Schedule

Client-server application for a public transport schedule (Gomel), deployed with Docker Compose.
Coursework project for the "Cloud Technologies of Data Analysis" course, Sukhoi State Technical University of Gomel.
The apps support English and Russian.

## Requirements

Passenger — Android app, no registration:

- R1 list of routes (bus, trolleybus, …) and their stops;
- R2 schedule of a selected stop, weekdays and weekends;
- R3 trip search between two stops by departure time and day type, with transfers (up to 2);
- R4 stops and routes on an OpenStreetMap map;
- R5 favourite stops and routes stored on the device.

Dispatcher — web panel with authorization:

- R6 sign-in with a single account whose login and password come from compose environment variables;
- R7 create, edit and delete routes, stops (placed by clicking the map) and schedules.

Data:

- R8 Gomel routes and stops with coordinates are imported automatically from OpenStreetMap (Overpass API);
  the dispatcher corrects them in the panel;
- R9 schedules are entered manually in the panel for now; a schedule import source will be chosen later,
  so schedule import is a replaceable module.

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
`DISPATCHER_PASSWORD`.

## Develop

```bash
cd server && npm install && npm test
cd dispatcher-web && npm install && npm test && npm run dev
cd android && ./gradlew test assembleDebug
```
