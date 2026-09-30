import { Hono } from "hono";
import { query } from "../db";
import { notFound } from "../http";
import { theatreSystemName } from "../theatreSystems";
import { CREDENTIAL_COLUMNS, type CredentialRow, toCredential } from "./credentials";
import { CONFIG_COLUMNS, type ConfigRow, toConfiguration } from "./agentConfigs";
import { GLOBAL_REF, type CredentialFieldDef } from "../../src/data/credentialsManagerData";
import { normalizeEntitlements, type ConfigFieldDef, type ConfigScope } from "../../src/data/agentConfigData";
import type { WtfAgent, WtfData, WtfScreenDevice } from "../../src/data/wtfData";
import type { DeliveryTimeSlot, DownloadRestrictions, Projection, Sound } from "../../src/types";

/** Mounted at /api/wtf: "What's This Facility", a read-only summary of one theatre. */
export const wtf = new Hono();

const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

wtf.get("/:theatreId", async (c) => {
  const [t] = await query<{
    id: string; uuid: string | null; name: string | null; alternate_names: string[] | null; city: string | null;
    state: string | null; country: string | null; chain_name: string | null; tms: string | null; ticketing: string | null;
    delivery: Record<string, unknown>;
  }>(
    `SELECT t.id, t.uuid, t.name, t.alternate_names, t.city, t.state, t.country, c.name AS chain_name,
            ${theatreSystemName("TMS")} AS tms, ${theatreSystemName("Ticketing System")} AS ticketing,
            t.delivery_settings AS delivery
     FROM theatres t LEFT JOIN chains c ON c.id = t.chain_id WHERE t.id = $1 AND t.status <> 'Deleted'`,
    [c.req.param("theatreId")],
  );
  if (!t) throw notFound("Theatre");
  const theatreName = t.name ?? "";
  const chainName = t.chain_name ?? "";
  const d = t.delivery ?? {};

  const [screens, devices, agents] = await Promise.all([
    query<{ id: string; name: string | null; number: string | null; seating_capacity: number | null; projection: Projection | null; sound: Sound | null }>(
      `SELECT id, name, number, seating_capacity, projection, sound FROM screens WHERE theatre_id = $1 AND status <> 'Deleted'
       ORDER BY substring(number FROM '^\\d+')::int NULLS LAST, number, name`,
      [t.id],
    ),
    screenDevices(t.id, theatreName, chainName, t.country ?? ""),
    theatreAgents(t.id, theatreName, chainName),
  ]);

  const data: WtfData = {
    theatre: {
      id: t.id,
      uuid: t.uuid ?? "",
      name: theatreName,
      alternateNames: t.alternate_names ?? [],
      city: t.city ?? "",
      state: t.state ?? "",
      country: t.country ?? "",
      chainName,
      tms: t.tms || null,
      ticketingSystem: t.ticketing || null,
    },
    isp: {
      enabled: d.downloadRestrictionsEnabled === true,
      restrictions: (d.downloadRestrictions as DownloadRestrictions | undefined) ?? null,
    },
    contentAutoIngestion: {
      enabled: d.autoIngestOfContentEnabled === true,
      contentTypes: list<string>(d.autoIngestContentTypes),
      timeSlots: list<DeliveryTimeSlot>(d.autoIngestTimeSlots),
    },
    kdmAutoIngestion: { timeSlots: list<DeliveryTimeSlot>(d.kdmAutoIngestTimeSlots) },
    screens: screens.map((s) => ({
      id: s.id,
      name: s.name ?? "",
      number: s.number ?? "",
      seatCount: s.seating_capacity,
      projectionType: s.projection?.projectionType || null,
      projectionExperiences: list<string>(s.projection?.experiences),
      audioExperiences: list<string>(s.sound?.audioExperiences),
    })),
    screenDevices: devices,
    agents,
  };
  return c.json(data);
});

/**
 * Screen devices with the credentials that apply to each: the device model is
 * matched in Credentials Manager by brand and model (or a translation), then
 * the most specific credential wins: device serial, theatre, chain, the
 * theatre's country, Global.
 */
async function screenDevices(theatreId: string, theatreName: string, chainName: string, country: string): Promise<WtfScreenDevice[]> {
  const [rows, models] = await Promise.all([
    query<{ id: string; screen_name: string | null; screen_number: string | null; manufacturer: string | null; model: string | null; role: string | null; serial_number: string | null }>(
      `SELECT d.id, s.name AS screen_name, s.number AS screen_number, d.manufacturer, d.model, d.role, d.serial_number
       FROM screen_devices d JOIN screens s ON s.id = d.screen_id WHERE s.theatre_id = $1 AND s.status <> 'Deleted'
       ORDER BY substring(s.number FROM '^\\d+')::int NULLS LAST, s.number, d.manufacturer, d.model`,
      [theatreId],
    ),
    query<{ id: string; brand: string; model: string; translations: string[]; roles: string[]; fields: CredentialFieldDef[] }>(
      `SELECT id, brand, model, translations, roles, credential_fields AS fields FROM credential_devices`,
    ),
  ]);

  const modelFor = (brand: string | null, model: string | null) =>
    models.find((m) => norm(m.brand) === norm(brand) && (norm(m.model) === norm(model) || m.translations.some((x) => norm(x) === norm(model))));
  const matched = new Map(rows.map((r) => [r.id, modelFor(r.manufacturer, r.model)]));
  const modelIds = Array.from(new Set(Array.from(matched.values()).filter(Boolean).map((m) => m!.id)));

  const creds = modelIds.length
    ? await query<CredentialRow & { deviceId: string }>(
        `SELECT ${CREDENTIAL_COLUMNS} FROM device_credentials WHERE device_id = ANY($1)`, [modelIds])
    : [];

  return rows.map((r) => {
    const model = matched.get(r.id);
    const serial = norm(r.serial_number);
    const forModel = model ? creds.filter((c) => c.deviceId === model.id) : [];
    const pick = (scope: string, ref: string) => (ref ? forModel.find((c) => c.scope === scope && norm(c.ref) === norm(ref)) : undefined);
    const best =
      (serial ? forModel.find((c) => c.scope === "device" && norm(c.ref) === serial) : undefined) ??
      pick("theatre", theatreName) ?? pick("chain", chainName) ?? pick("global", country) ?? pick("global", GLOBAL_REF);
    const cred = best && model ? toCredential(best, model.fields) : null;
    return {
      id: r.id,
      screenName: r.screen_name ?? "",
      screenNumber: r.screen_number ?? "",
      brand: r.manufacturer ?? "",
      model: r.model ?? "",
      // The device's own role, else the roles of its model in Credentials Manager
      role: r.role || (model?.roles ?? []).join(", "),
      serialNumber: r.serial_number ?? "",
      deviceModelId: model?.id ?? null,
      credentials: cred && model
        ? {
            deviceModelId: model.id,
            credentialId: cred.id,
            scope: cred.scope,
            ref: cred.ref,
            fields: model.fields,
            values: cred.values,
            maskedKeys: cred.maskedKeys,
            updatedAt: cred.updatedAt,
          }
        : null,
    };
  });
}

/**
 * Agents installed on the theatre's appliances, with the configuration that
 * applies here: per field, the theatre row, else the chain row, else Global.
 */
async function theatreAgents(theatreId: string, theatreName: string, chainName: string): Promise<WtfAgent[]> {
  const installed = await query<{ id: string; name: string; provider: string; entitlements: string[]; fields: ConfigFieldDef[]; levels: ConfigScope[]; versions: string[] }>(
    `SELECT i.id, i.agent_os_name AS name, i.provider, i.entitlements, i.config_fields AS fields, i.config_levels AS levels,
            array_agg(DISTINCT ni.version) FILTER (WHERE ni.version IS NOT NULL) AS versions
     FROM fleet_nodes n
     JOIN fleet_node_images ni ON ni.node_id = n.id
     JOIN fleet_images i ON i.id = ni.image_id
     WHERE n.theatre_id = $1 AND i.provider <> 'Appliance OS'
     GROUP BY i.id ORDER BY i.agent_os_name`,
    [theatreId],
  );
  if (installed.length === 0) return [];
  const configurations = await configurationsFor(installed, chainName, theatreName);
  return installed.map((a) => ({
    imageId: a.id,
    name: a.name,
    provider: a.provider,
    versions: a.versions ?? [],
    entitlements: normalizeEntitlements(a.entitlements),
    configuration: configurations.get(a.id) ?? [],
  }));
}

/**
 * Per agent, the configuration that applies at a theatre: for each field, the theatre row, else the chain row,
 * else Global, skipping levels the agent has turned off. Masked values are never returned, only flagged.
 */
export async function configurationsFor(
  agents: { id: string; fields: ConfigFieldDef[]; levels: ConfigScope[] }[], chainName: string, theatreName: string,
): Promise<Map<string, WtfAgent["configuration"]>> {
  const configs = await query<ConfigRow>(
    `SELECT ${CONFIG_COLUMNS} FROM agent_configurations
     WHERE image_id = ANY($1) AND ((scope = 'global') OR (scope = 'chain' AND ref = $2) OR (scope = 'theatre' AND ref = $3))`,
    [agents.map((a) => a.id), chainName, theatreName],
  );
  return new Map(agents.map((a) => {
    const rows = configs.filter((c) => c.imageId === a.id && a.levels.includes(c.scope)).map((c) => toConfiguration(c, a.fields));
    const ordered = ["theatre", "chain", "global"].map((scope) => rows.find((r) => r.scope === scope)).filter((r) => !!r);
    return [a.id, a.fields.map((field) => {
      const src = ordered.find((r) => r.maskedKeys.includes(field.key) || r.values[field.key] !== undefined);
      const masked = !!src?.maskedKeys.includes(field.key);
      return {
        field,
        value: src && !masked ? src.values[field.key] : null,
        masked,
        configId: src?.id ?? null,
        source: src?.scope ?? null,
        sourceRef: src?.ref ?? null,
        updatedAt: src?.updatedAt ?? null,
      };
    })];
  }));
}
