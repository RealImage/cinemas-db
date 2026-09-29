// Loads the frontend mock data (src/data) into Postgres so the DB matches what
// the UI shows today.
// Usage: npm run db:seed              seed an empty database
//        npm run db:seed -- --force   replace existing data (see SEEDED_TABLES)
import type pg from "pg";
import { createClient, insertMany, describeDatabase } from "./client";
import { theatres, chains, companies, tdlDevices } from "../src/data/mockData";
import { wireTapDevices } from "../src/data/wireTapDevices";
import { newWireTapDevices } from "../src/data/newWireTapDevices";
import { qubeAcsTheatres, lookupTheatres as qubeAcsLookupTheatres } from "../src/data/qubeAcsData";
import { pulseTheatres, pulseLookupTheatres } from "../src/data/pulseData";
import { edgeTheatres, edgeLookupTheatres } from "../src/data/edgeData";
import { icountTheatres, icountLookupTheatres } from "../src/data/icountData";
import { flmFeeds } from "../src/data/flmFeedsData";
import { companyClaimsData } from "../src/data/companyClaimsData";
import { partnersData } from "../src/data/partnersData";
import { generateScreenTimeSeries } from "../src/data/environmentTimeSeriesData";
import { extraSeeders } from "./seeds";

const SENSOR_SCREEN_LIMIT = 25; // screens that get a month of sensor history

// Tables this script populates. A forced re-seed truncates them with CASCADE,
// which also empties rows that reference them (e.g. suites, closures).
const SEEDED_TABLES = [
  "companies", "chains", "theatres", "theatre_mappings", "screens", "screen_devices",
  "screen_ip_addresses", "tdl_devices", "wiretap_devices", "theatre_appliance_configs",
  "screen_appliances", "icount_cameras", "screen_sensor_readings", "screen_sensor_thresholds",
  "flm_feeds", "company_claims", "partner_requests",
];
const ALL_SEEDED_TABLES = [...SEEDED_TABLES, ...extraSeeders.flatMap((s) => s.tables)];

type ApplianceTheatre = {
  theatreId: string;
  theatreName: string;
  alsoKnownAs?: string;
  city: string;
  state: string;
  country: string;
  chainName: string;
  latitude: number;
  longitude: number;
  updatedAt?: string;
  updatedBy?: string;
};

const nullIfEmpty = (v?: string) => (v ? v : null);

class Seeder {
  private chainIdsByName = new Map<string, string>();
  private theatreIdsByCode = new Map<string, string>();
  private theatreIds = new Set<string>();
  private screenIds = new Set<string>();

  constructor(private client: pg.Client, private force: boolean) {}

  async run() {
    await this.truncate();
    await this.organizations();
    await this.coreTheatres();
    await this.tdl();
    await this.wiretap();
    await this.applianceModule("qube_acs", qubeAcsTheatres, qubeAcsLookupTheatres);
    await this.applianceModule("pulse", pulseTheatres, pulseLookupTheatres);
    await this.applianceModule("edge", edgeTheatres, edgeLookupTheatres);
    await this.icount();
    await this.sensorReadings();
    await this.flm();
    await this.approvals();
    for (const seeder of extraSeeders) await seeder.run(this.client);
  }

  private async truncate() {
    const { rows } = await this.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1)`,
      [ALL_SEEDED_TABLES],
    );
    if (rows[0].n !== ALL_SEEDED_TABLES.length) throw new Error("Schema missing — run `npm run db:migrate` first.");

    const { rows: existing } = await this.client.query<{ has_data: boolean }>(
`SELECT EXISTS (SELECT 1 FROM companies) OR EXISTS (SELECT 1 FROM chains) OR EXISTS (SELECT 1 FROM theatres) OR EXISTS (SELECT 1 FROM theatre_mappings) OR EXISTS (SELECT 1 FROM screens) OR EXISTS (SELECT 1 FROM screen_devices) OR EXISTS (SELECT 1 FROM screen_ip_addresses) OR EXISTS (SELECT 1 FROM tdl_devices) OR EXISTS (SELECT 1 FROM wiretap_devices) OR EXISTS (SELECT 1 FROM theatre_appliance_configs) OR EXISTS (SELECT 1 FROM screen_appliances) OR EXISTS (SELECT 1 FROM icount_cameras) OR EXISTS (SELECT 1 FROM screen_sensor_readings) OR EXISTS (SELECT 1 FROM screen_sensor_thresholds) OR EXISTS (SELECT 1 FROM flm_feeds) OR EXISTS (SELECT 1 FROM company_claims) OR EXISTS (SELECT 1 FROM partner_requests) AS has_data`,
    );
    if (!existing[0].has_data) return;
    if (!this.force) {
      throw new Error(
        "Database already has data. Re-seeding replaces it (and dependent rows); " +
        "run `npm run db:seed -- --force` or `npm run db:reset`.",
      );
    }
    await this.client.query(`TRUNCATE ${ALL_SEEDED_TABLES.join(", ")} RESTART IDENTITY CASCADE`);
  }

  private async organizations() {
    // Theatres reference some chains/companies that aren't in the lists; derive those.
    const allCompanies = new Map(companies.map((c) => [c.id, { id: c.id, name: c.name, status: c.status, created_at: c.createdAt, updated_at: c.updatedAt }]));
    const allChains = new Map(chains.map((c) => [c.id, { id: c.id, company_id: c.companyId, name: c.name, status: c.status, created_at: c.createdAt, updated_at: c.updatedAt }]));
    const now = new Date().toISOString();
    for (const t of theatres) {
      if (!allCompanies.has(t.companyId)) {
        allCompanies.set(t.companyId, { id: t.companyId, name: t.companyName, status: "Active", created_at: now, updated_at: now });
      }
      if (!allChains.has(t.chainId)) {
        allChains.set(t.chainId, { id: t.chainId, company_id: t.companyId, name: t.chainName, status: "Active", created_at: now, updated_at: now });
      }
    }
    await insertMany(this.client, "companies", [...allCompanies.values()]);
    await insertMany(this.client, "chains", [...allChains.values()]);
    allChains.forEach((c) => this.chainIdsByName.set(c.name, c.id));
  }

  /** Appliance modules only carry chain names; create chains on demand. */
  private async chainId(name: string) {
    let id = this.chainIdsByName.get(name);
    if (!id) {
      const { rows } = await this.client.query<{ id: string }>(
        "INSERT INTO chains (name) VALUES ($1) RETURNING id", [name],
      );
      id = rows[0].id;
      this.chainIdsByName.set(name, id);
    }
    return id;
  }

  private async coreTheatres() {
    await insertMany(this.client, "theatres", theatres.map((t) => ({
      id: t.id,
      uuid: t.uuid,
      third_party_id: nullIfEmpty(t.thirdPartyId),
      chain_id: t.chainId,
      company_id: t.companyId,
      name: t.name,
      display_name: t.displayName,
      alternate_names: t.alternateNames ?? [],
      listing: t.listing ?? null,
      type: t.type,
      status: t.status,
      address: t.address,
      city: t.city,
      state: t.state,
      country: t.country,
      postal_code: t.postalCode,
      latitude: t.latitude ?? null,
      longitude: t.longitude ?? null,
      timezone: t.timezone ?? null,
      phone_number: t.phoneNumber,
      email: t.email,
      website: t.website ?? null,
      contact: t.contact ?? null,
      location_type: t.locationType ?? null,
      bike_parking_available: t.bikeParkingAvailable ?? null,
      bike_parking_capacity: t.bikeParkingCapacity ?? null,
      car_parking_available: t.carParkingAvailable ?? null,
      car_parking_capacity: t.carParkingCapacity ?? null,
      start_date: t.startDate ?? null,
      notes: t.notes ?? null,
      closure_details: t.closureDetails ?? null,
      exhibitor_integrator_companies: t.exhibitorIntegratorCompanies ?? [],
      ad_integrators: t.adIntegrators ?? [],
      delivery_settings: {
        deliveryAddress: t.deliveryAddress,
        deliveryInstructions: t.deliveryInstructions,
        deliveryTimeSlots: t.deliveryTimeSlots,
        dcpPhysicalDeliveryMethods: t.dcpPhysicalDeliveryMethods,
        dcpNetworkDeliveryMethods: t.dcpNetworkDeliveryMethods,
        dcpModemDeliveryMethods: t.dcpModemDeliveryMethods,
        dcpDeliveryContacts: t.dcpDeliveryContacts,
        sendEmailsForDCPDelivery: t.sendEmailsForDCPDelivery,
        dcpContentTypesForEmail: t.dcpContentTypesForEmail,
        keyDeliveryContacts: t.keyDeliveryContacts,
        kdmDeliveryEmailsInFLMX: t.kdmDeliveryEmailsInFLMX,
        autoIngestOfContentEnabled: t.autoIngestOfContentEnabled,
        autoIngestContentTypes: t.autoIngestContentTypes,
        qcnTheatreIPAddressRange: t.qcnTheatreIPAddressRange,
        downloadRestrictionsEnabled: t.downloadRestrictionsEnabled,
        downloadRestrictions: t.downloadRestrictions,
        liveWireEnabled: t.liveWireEnabled,
        liveWireConfig: t.liveWireConfig,
      },
      configuration_notes: t.configurationNotes ?? null,
      created_at: t.createdAt,
      updated_at: t.updatedAt,
      created_by: t.createdBy ?? null,
      updated_by: t.updatedBy ?? null,
    })));
    theatres.forEach((t) => this.theatreIds.add(t.id));

    await insertMany(this.client, "theatre_mappings", theatres.flatMap((t) =>
      (t.theatreMappings ?? []).map((m) => ({ theatre_id: t.id, domain: m.domain, external_id: m.theatreId })),
    ), { onConflict: "ON CONFLICT DO NOTHING" });

    const screens = theatres.flatMap((t) => t.screens ?? []);
    await insertMany(this.client, "screens", screens.map((s) => ({
      id: s.id,
      theatre_id: s.theatreId,
      number: s.number,
      name: s.name,
      uuid: s.uuid,
      third_party_id: nullIfEmpty(s.thirdPartyId),
      status: s.status,
      auto_screen_update_lock: s.autoScreenUpdateLock,
      flm_management_lock: s.flmManagementLock,
      multi_thumbprint_kdm_screen: s.multiThumbprintKdmScreen,
      seating_capacity: s.seatingCapacity ?? null,
      cooling_type: s.coolingType ?? null,
      wheelchair_accessibility: s.wheelchairAccessibility,
      motion_seats: s.motionSeats,
      closure_notes: s.closureNotes ?? null,
      operators: JSON.stringify(s.operators ?? []),
      dimensions: s.dimensions ?? {},
      projection: s.projection ?? {},
      sound: s.sound ?? {},
      created_at: s.createdAt ?? new Date().toISOString(),
      updated_at: s.updatedAt ?? new Date().toISOString(),
    })));
    screens.forEach((s) => this.screenIds.add(s.id));

    await insertMany(this.client, "screen_devices", screens.flatMap((s) => s.devices.map((d) => ({
      id: d.id,
      screen_id: s.id,
      manufacturer: d.manufacturer,
      model: d.model,
      serial_number: d.serialNumber,
      role: d.role ?? null,
      certificate_status: d.certificateStatus,
      certificate_lock_status: d.certificateLockStatus,
      software_version: d.softwareVersion,
    }))));

    await insertMany(this.client, "screen_ip_addresses", screens.flatMap((s) => s.ipAddresses.map((ip) => ({
      screen_id: s.id, address: ip.address, subnet: ip.subnet, gateway: ip.gateway,
    }))));
  }

  private async tdl() {
    await insertMany(this.client, "tdl_devices", tdlDevices.map((d) => ({
      id: d.id,
      manufacturer: d.manufacturer,
      model: d.model,
      serial_number: d.serialNumber,
      software_version: d.softwareVersion,
      firmware_version: d.firmwareVersion,
      device_role: d.deviceRole,
      certificate_status: d.certificateStatus,
      certificate_auto_sync: d.certificateAutoSync,
      auto_update_certificate: d.autoUpdateCertificate,
      valid_till: d.validTill,
      public_key_thumbprint: d.publicKeyThumbprint,
      issuer_thumbprint: d.issuerThumbprint,
      source: d.source,
      retired: d.retired,
      updated_at: d.updatedOn,
      updated_by: d.updatedBy,
    })), { chunkSize: 1000 });
  }

  private async wiretap() {
    const devices = [...wireTapDevices, ...newWireTapDevices];
    // Device theatreIds collide with core theatre IDs (e.g. "1" is a different
    // theatre on the device), so key on the snapshot's UUID instead.
    const theatreIdByUuid = new Map(theatres.map((t) => [t.uuid, t.id]));
    for (const d of devices) {
      if (theatreIdByUuid.has(d.theatreUUID)) continue;
      const { rows } = await this.client.query<{ id: string }>(
        `INSERT INTO theatres (uuid, name, address, alternate_names) VALUES ($1, $2, $3, $4) RETURNING id`,
        [d.theatreUUID, d.theatreName, d.theatreAddress, d.theatreAlternateNames ?? []],
      );
      theatreIdByUuid.set(d.theatreUUID, rows[0].id);
    }
    await insertMany(this.client, "wiretap_devices", devices.map((d) => ({
      id: d.id,
      theatre_id: theatreIdByUuid.get(d.theatreUUID),
      hardware_serial_number: d.hardwareSerialNumber,
      application_serial_number: d.applicationSerialNumber,
      host_name: d.hostName,
      cluster_name: d.clusterName ?? null,
      connectivity_type: d.connectivityType,
      isp_name: d.ispName,
      storage_capacity: d.storageCapacity,
      bandwidth: d.bandwidth,
      appliance_type: d.wireTapApplianceType,
      activation_status: d.activationStatus,
      mapping_status: d.mappingStatus,
      vpn_status: d.vpnStatus,
      pull_out_status: d.pullOutStatus,
      connectivity: d.connectivity ?? null,
      updated_at: d.updatedAt,
      updated_by: d.updatedBy,
    })));
  }

  /** Ensure a theatre identified by its business code exists; returns its id. */
  private async theatreByCode(t: ApplianceTheatre) {
    const existing = this.theatreIdsByCode.get(t.theatreId);
    if (existing) return existing;
    const { rows } = await this.client.query<{ id: string }>(
      `INSERT INTO theatres (code, name, alternate_names, city, state, country, latitude, longitude, chain_id, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [t.theatreId, t.theatreName, t.alsoKnownAs ? [t.alsoKnownAs] : [], t.city, t.state, t.country,
        t.latitude, t.longitude, await this.chainId(t.chainName), t.updatedBy ?? null],
    );
    this.theatreIdsByCode.set(t.theatreId, rows[0].id);
    return rows[0].id;
  }

  /** Screen IDs like "SCR-1-1" repeat across modules, so namespace by theatre code. */
  private async screen(theatreId: string, theatreCode: string, screenId: string, name: string) {
    const id = `${theatreCode}:${screenId}`;
    if (!this.screenIds.has(id)) {
      await this.client.query(
        "INSERT INTO screens (id, theatre_id, number, name) VALUES ($1, $2, $3, $4)",
        [id, theatreId, screenId.split("-").pop(), name],
      );
      this.screenIds.add(id);
    }
    return id;
  }

  private async applianceModule(
    type: "qube_acs" | "pulse" | "edge",
    enrolled: (ApplianceTheatre & {
      networkId?: string;
      networkPassword?: string;
      screens: {
        screenId: string; screenName: string; hasDevice: boolean; status: string;
        applianceId?: string; ipAddress?: string; installedDate?: string; installedBy?: string;
        lastActiveOn?: string; cmSerialNumber?: string; screenNetworkId?: string;
        screenNetworkPassword?: string; comments?: string;
      }[];
    })[],
    lookup: ApplianceTheatre[],
  ) {
    for (const t of lookup) await this.theatreByCode(t);

    const appliances: Record<string, unknown>[] = [];
    for (const t of enrolled) {
      const theatreId = await this.theatreByCode(t);
      await this.client.query(
        `INSERT INTO theatre_appliance_configs (theatre_id, appliance_type, network_id, network_password, updated_at, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [theatreId, type, t.networkId ?? null, t.networkPassword ?? null, t.updatedAt ?? new Date(), t.updatedBy ?? null],
      );
      for (const s of t.screens) {
        const screenId = await this.screen(theatreId, t.theatreId, s.screenId, s.screenName);
        if (!s.hasDevice) continue;
        appliances.push({
          screen_id: screenId,
          appliance_type: type,
          appliance_id: s.applianceId ?? null,
          serial_number: s.cmSerialNumber ?? null,
          ip_address: s.ipAddress ?? null,
          screen_network_id: s.screenNetworkId ?? null,
          screen_network_password: s.screenNetworkPassword ?? null,
          status: s.status,
          installed_at: s.installedDate ?? null,
          installed_by: s.installedBy ?? null,
          last_active_at: s.lastActiveOn ?? null,
          comments: s.comments ?? null,
          updated_by: t.updatedBy ?? null,
        });
      }
    }
    await insertMany(this.client, "screen_appliances", appliances);
  }

  private async icount() {
    for (const t of icountLookupTheatres) await this.theatreByCode(t);
    const cameras: Record<string, unknown>[] = [];
    for (const t of icountTheatres) {
      const theatreId = await this.theatreByCode(t);
      for (const s of t.screens) {
        const screenId = await this.screen(theatreId, t.theatreId, s.screenId, s.screenName);
        if (!s.hasCameras) continue;
        for (const c of s.cameras) {
          cameras.push({
            id: `${t.theatreId}:${c.cameraId}`,
            screen_id: screenId,
            label: c.label,
            make: c.make ?? null,
            model: c.model ?? null,
            serial_number: c.serialNumber ?? null,
            ownership: c.ownership ?? null,
            ip_address: c.ipAddress ?? null,
            updated_at: t.updatedAt,
            updated_by: t.updatedBy,
          });
        }
      }
    }
    await insertMany(this.client, "icount_cameras", cameras);
  }

  private async sensorReadings() {
    const { rows } = await this.client.query<{ screen_id: string }>(
      `SELECT screen_id FROM screen_appliances WHERE appliance_type = 'pulse' ORDER BY id LIMIT $1`,
      [SENSOR_SCREEN_LIMIT],
    );
    for (const { screen_id } of rows) {
      const series = generateScreenTimeSeries(screen_id, "1M");
      const metrics = ["temperature", "humidity", "dust"] as const;
      await insertMany(this.client, "screen_sensor_readings", metrics.flatMap((metric) =>
        series[metric].map((p) => ({
          screen_id, metric, recorded_at: new Date(p.timestamp), value: p.value, is_on_period: p.isOnPeriod,
        })),
      ));
      await insertMany(this.client, "screen_sensor_thresholds", metrics.map((metric) => ({
        screen_id,
        metric,
        on_upper: series.thresholds[metric].onUpper,
        on_lower: series.thresholds[metric].onLower,
        off_upper: series.thresholds[metric].offUpper,
        off_lower: series.thresholds[metric].offLower,
      })));
    }
  }

  private async flm() {
    await insertMany(this.client, "flm_feeds", flmFeeds.map((f) => ({
      id: f.id,
      source: f.source,
      feed_theatre_id: f.theatreIdFeed,
      theatre_uuid: f.theatreUuid,
      theatre_name: f.theatreName,
      theatre_display_name: f.theatreDisplayName,
      chain_name: f.chain,
      address: f.address,
      location: f.location,
      is_new_theatre: f.isNewTheatre,
      status: f.status,
      mapped_theatre_id: f.mappedTheatreId && this.theatreIds.has(f.mappedTheatreId) ? f.mappedTheatreId : null,
      details: f.details ?? null,
      received_at: f.receivedOn,
    })));
  }

  private async approvals() {
    await insertMany(this.client, "company_claims", companyClaimsData.map((c) => ({
      id: c.id,
      company_name: c.companyName,
      legal_name: c.legalName,
      company_type: c.companyType,
      company_role: c.companyRole,
      street_address: c.streetAddress,
      city: c.city,
      location: c.location,
      website: c.companyWebsite,
      phone: c.companyPhone,
      chain_claims: c.chainClaims,
      theatre_claims: c.theatreClaims,
      theatre_count: c.theatreCount,
      screen_count: c.screenCount,
      claimed_by: c.claimedBy,
      claimed_at: c.claimedOn,
      last_claimed_at: c.lastClaimedOn,
    })));
    await insertMany(this.client, "partner_requests", partnersData.map((p) => ({
      id: p.id,
      company: p.company,
      name: p.name,
      legal_name: p.companyLegalName,
      company_role: p.companyRole,
      street_address: p.streetAddress,
      city: p.city,
      state: p.state,
      country: p.country,
      location: p.location,
      website: p.companyWebsite,
      phone: p.companyPhone,
      requested_by: p.requestedBy,
      requested_at: p.requestCreatedOn,
    })));
  }
}

async function main() {
  const client = createClient();
  await client.connect();
  try {
    await client.query("BEGIN");
    await new Seeder(client, process.argv.includes("--force")).run();
    await client.query("COMMIT");
    const { rows } = await client.query(`
      SELECT table_name AS table,
             (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I', table_name), false, true, '')))[1]::text::int AS rows
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'schema_migrations'
      ORDER BY table_name`);
    console.log(`Seeded ${describeDatabase()}`);
    console.table(rows);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
