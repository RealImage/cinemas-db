# CinemaDB

CinemaDB is Qube Cinema's master data app for theatres, chains, screens and the devices installed in them. It covers:

- **Theatres:** theatre list, FLM feeds and mapping, dashboard
- **Chains**
- **Fleet management:** fleet status, tasks, images, agent configurations
- **Qube appliances:** WireTAP, Qube ACS, Pulse, Edge, iCount cameras
- **Devices master:** screen devices, TDL devices, credentials manager
- **Screen Pulse:** dashboard, environment, projection and screen managers, reports
- **Approvals & conflicts**
- **Location management:** countries, provinces, cities, metro areas, timezones, and a Reference sync review queue

## Stack

- **Web:** Vite, React 18, TypeScript, Tailwind CSS, shadcn/ui (Radix), TanStack Query, styled to the Qube Design System
- **API:** [Hono](https://hono.dev) on Node (`server/`)
- **Database:** PostgreSQL 16 in Docker, with SQL migrations and TypeScript seeders (`db/`)

## Getting started

Prerequisites: Node.js 22+, npm, and Docker.

```sh
npm install
cp .env.example .env      # defaults work as-is
npm run db:setup          # start Postgres, run migrations, load sample data
npm run dev               # web on http://localhost:8080, API on :3001
```

In development, Vite proxies `/api` to the API server on `API_PORT`.

Masked credential and agent configuration values are encrypted with `CREDENTIALS_ENCRYPTION_KEY` (see `.env.example`). Development falls back to a built-in key; production must set its own (`openssl rand -base64 32`), and changing it later makes stored masked values unreadable.

### Locations and Reference sync

Location master data (`db/seeds/data/locations.json`) comes from [GeoNames](https://www.geonames.org/) (CC BY 4.0): every country, plus the provinces and the cities of 100,000+ people in the countries that have theatres. Timezones come from the IANA tz database; their UTC and DST offsets are derived from the IANA ID at runtime, never typed in. Theatres link to a city (`theatres.city_id`), and their city, state, country and timezone text follow it.

Reference sync compares CinemaDB with GeoNames and IANA and lists every difference on *Location Management → Review* as New, Missing, Mismatch or Duplicate. It changes nothing on its own, except linking an unlinked record to the reference record it matches; admins decide each item, and every decision is logged. The API runs it nightly at `LOCATION_SYNC_HOUR` (default 2, server time) and on *Run now*; it downloads about 5 MB and needs internet access. Set `LOCATION_SYNC_SCHEDULE=off` to disable the nightly run.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Web app and API together, with reload |
| `npm run dev:web` | Web app only |
| `npm run dev:api` | API only, with reload |
| `npm run build` | Production build of the web app into `dist/` |
| `npm run build:dev` | Build with `--mode development` (development env and mode flags) |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run start:api` | Run the API without watching |
| `npm run typecheck` | Type-check the app and the server |
| `npm run lint` | ESLint |
| `npm run db:up` | Start the Postgres container |
| `npm run db:down` | Stop the Postgres container (data is kept in the `pgdata` volume) |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Load sample data |
| `npm run db:seed:one -- <name>` | Run one seeder (e.g. `credentials`) |
| `npm run db:reset` | Drop everything, re-migrate and re-seed |
| `npm run db:psql` | Open `psql` in the container |

## Project layout

```text
src/
  pages/          route pages
  components/     feature components; ui/ holds the shared design-system parts
  hooks/api/      TanStack Query hooks, one file per API area
  lib/api.ts      fetch client for /api
  i18n/           shared UI strings (button labels etc.)
  data/, types/   shared types, constants and option lists
server/
  routes/         one Hono router per area, mounted under /api
db/
  migrations/     numbered SQL migrations
  seed.ts, seeds/ sample data
```

## Conventions

- **Filters** open in the right-hand filter drawer (`ui/filter-drawer.tsx`) and apply only when you press *Apply filters*.
- **Search, filters and pagination** run over the full result set. Tables default to 100 rows per page, with 200, 500 and 1000 as options.
- **List pickers** use the searchable `Combobox` (`ui/combobox.tsx`) rather than a plain select.
- **Masked fields** (credentials and agent configurations) are stored encrypted (AES-256-GCM, `db/secrets.ts`). The API never includes them in lists; the UI fetches one value at a time when someone clicks its eye icon.
- **Dialog buttons** take generic labels such as *Save* and *Cancel* from `src/i18n/common.ts`, so each string is translated once.
