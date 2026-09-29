import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { query } from "./db";
import { routes } from "./routes";

export const app = new Hono().basePath("/api");

app.use("*", logger());

app.get("/health", async (c) => {
  await query("SELECT 1");
  return c.json({ ok: true });
});

for (const [path, router] of Object.entries(routes)) app.route(`/${path}`, router);

app.notFound((c) => c.json({ error: "Not found" }, 404));

/** Database rules whose violation is the caller's mistake (a race the handlers' own checks can't see), as 409s. */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  screens_number_unique: "Another screen in this theatre already has that number",
  screens_name_unique: "Another screen in this theatre already has that name",
};

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  const constraint = (err as { constraint?: string }).constraint;
  if (constraint && constraint in CONSTRAINT_MESSAGES) return c.json({ error: CONSTRAINT_MESSAGES[constraint] }, 409);
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});
