// API server between the React app and Postgres.
// Dev: `npm run dev` runs this alongside Vite, which proxies /api here.
import { serve } from "@hono/node-server";
import { describeDatabase } from "../db/client";
import { assertEncryptionKey } from "../db/secrets";
import { app } from "./app";
import { startNightlySync } from "./locations/sync";

// Fail fast on a missing or malformed CREDENTIALS_ENCRYPTION_KEY
assertEncryptionKey();

const port = Number(process.env.API_PORT ?? 3001);

serve({ fetch: app.fetch, port }, () => {
  console.log(`API listening on http://localhost:${port}/api (db ${describeDatabase()})`);
});

// Nightly Reference sync of locations (LOCATION_SYNC_SCHEDULE=off to disable)
void startNightlySync();
