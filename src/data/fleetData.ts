// Fleet management: shared types (used by the UI, the API and the seeder) and
// the source data the "fleet" seeder writes to Postgres. The pages no longer
// import the records below at runtime — they read them through /api/fleet.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FleetTaskType = "WireOS Update" | "Agent Update" | "Agent Deactivate" | "PartnerOS Update" | "Others";
export type FleetTaskStatus = "Scheduled" | "In Progress" | "Completed" | "Cancelled" | "Failed";
export type FleetNodeStatus = "Active" | "Inactive" | "Unresponsive";
export type ApplianceUpdateStatus = "Pending" | "In Progress" | "Completed" | "Failed" | "Cancelled";

export const FLEET_TASK_TYPES: FleetTaskType[] = ["WireOS Update", "Agent Update", "Agent Deactivate", "PartnerOS Update", "Others"];
export const FLEET_TASK_STATUSES: FleetTaskStatus[] = ["Scheduled", "In Progress", "Completed", "Cancelled", "Failed"];
export const FLEET_TIMEZONES = ["PST", "EST", "CST", "MST", "GMT", "UTC", "IST", "AEST"];

/** A row on Image Management (an OS / agent / app that is installed on appliances). */
export interface ImageItem {
  id: string;
  provider: string;
  agentOsName: string;
  latestVersion: string;
  defaultVersion: string | null;
  updatedOn: string;
  updatedBy: string;
  defaultInstall?: boolean;
}

export interface VersionItem {
  id: string;
  version: string;
  releaseDate: string;
  status: "stable" | "deprecated" | string;
  imageUrl: string;
  releaseNotes: string;
  internalNotes: string;
  addedOn: string;
  addedBy: string;
  deprecatedOn?: string;
  deprecationNotes?: string;
  deprecatedBy?: string;
  isDefault?: boolean;
}

export interface ImageLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  user: string;
  status: "success" | "info" | "warning" | "error";
}

/** One appliance's install of the selected image, as shown on Fleet Status. */
export interface FleetNode {
  /** Unique per node + image. */
  id: string;
  /** fleet_nodes.id — what tasks target. */
  applianceId: string;
  nodeId: string;
  theatreChain: string;
  theatreName: string;
  theatreId: string;
  city: string;
  state: string;
  country: string;
  version: string;
  status: FleetNodeStatus;
  deprecated: boolean;
  lastHeartbeat: string;
  lastUpdateTask: string | null;
  alternateNames: string[];
  uuid: string;
  address: string;
  /** From the linked theatre; null when the appliance's theatre isn't in CinemaDB. */
  displayName: string | null;
  postalCode: string | null;
  clusterName: string;
  applianceSerialNumber: string;
  hardwareSerialNumber: string;
}

export interface FleetTask {
  id: string;
  taskId: string;
  taskType: FleetTaskType;
  triggerDate: string; // "YYYY-MM-DD HH:mm"
  triggerTimezone: string;
  description: string;
  createdBy: string;
  createdOn: string;
  status: FleetTaskStatus;
  targetVersion?: string;
  affectedDevices?: number;
  /** Image id of the agent for Agent Update / Deactivate tasks. */
  selectedAgent?: string;
  agentName?: string;
}

export interface FleetLocation {
  city: string;
  state: string;
  country: string;
}

/** An appliance that can be targeted by a task (Add Appliance / Target Appliances). */
export interface TaskAppliance {
  id: string;
  applianceSerialNumber: string;
  hardwareSerialNumber: string;
  nodeId: string;
  clusterName: string;
  theatreId?: string | null;
  theatreName: string;
  theatreLocation: FleetLocation;
  chainName: string;
  chainAddress: FleetLocation;
  updateStatus: ApplianceUpdateStatus;
  updatedOn: string;
}

export interface AttemptLog {
  attemptNumber: number;
  timestamp: string;
  status: "Success" | "Failed";
  message: string;
}

/** A task target with its progress, as shown on Task View. */
export interface TaskApplianceProgress extends Omit<TaskAppliance, "updatedOn"> {
  clusterId: string;
  updatedOn: string | null;
  addedOn: string;
  attemptLogs: AttemptLog[];
}

export interface FleetTaskDetail extends FleetTask {
  triggerDay: string; // "YYYY-MM-DD"
  triggerTime: string; // "HH:mm"
  appliances: TaskApplianceProgress[];
}

export interface SaveFleetTaskInput {
  taskType: FleetTaskType;
  triggerDate: string;
  triggerTime: string;
  triggerTimezone: string;
  description: string;
  targetVersion?: string;
  imageId?: string;
  nodeIds: string[];
}

export interface FleetTheatre {
  id: string;
  code: string | null;
  thirdPartyId: string | null;
  name: string;
}

export interface FleetAgentOption {
  id: string;
  name: string;
  versions: string[];
}

export interface FleetTaskOptions {
  wireOSVersions: string[];
  partnerOSVersions: string[];
  agents: FleetAgentOption[];
}

// ---------------------------------------------------------------------------
// Deterministic randomness for generated seed data
// ---------------------------------------------------------------------------

/** mulberry32: small seeded PRNG so re-seeding yields identical rows. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rand: () => number, list: T[]) => list[Math.floor(rand() * list.length)];

/** Fixed "now" for generated timestamps so seeds are stable. */
export const FLEET_SEED_NOW = Date.parse("2024-03-20T12:00:00Z");

// ---------------------------------------------------------------------------
// Images, versions, logs
// ---------------------------------------------------------------------------

export interface SeedImage {
  id: string;
  provider: string;
  agentOsName: string;
  latestVersion: string;
  updatedOn: string;
  updatedBy: string;
  defaultInstall?: boolean;
}

export const fleetImages: SeedImage[] = [
  { id: "1", provider: "Appliance OS", agentOsName: "WireOS", latestVersion: "v4.2.0", updatedOn: "2024-01-15", updatedBy: "System", defaultInstall: true },
  { id: "2", provider: "Appliance OS", agentOsName: "QWA-OS", latestVersion: "v3.14.21", updatedOn: "2024-01-08", updatedBy: "Admin" },
  { id: "3", provider: "Appliance OS", agentOsName: "PartnerOS", latestVersion: "v3.12.14", updatedOn: "2024-01-05", updatedBy: "System" },
  { id: "4", provider: "iCount", agentOsName: "iCount", latestVersion: "v2.5.17", updatedOn: "2024-01-12", updatedBy: "John Doe" },
  { id: "5", provider: "Qlog", agentOsName: "Qlog Agent", latestVersion: "v1.3.2", updatedOn: "2024-01-09", updatedBy: "Jane Smith" },
  { id: "6", provider: "Qube Wire", agentOsName: "Kadet (Agent Zero)", latestVersion: "v1.1.3", updatedOn: "2024-01-11", updatedBy: "Mike Johnson", defaultInstall: true },
  { id: "7", provider: "Qube Wire", agentOsName: "Agent Redux", latestVersion: "v4.2.6", updatedOn: "2024-01-13", updatedBy: "System" },
  { id: "8", provider: "Qube Wire", agentOsName: "Manifest Agent", latestVersion: "v4.0.0", updatedOn: "2024-01-07", updatedBy: "Admin" },
  { id: "9", provider: "Qube Wire", agentOsName: "Content Ingest Agent", latestVersion: "v1.2.3", updatedOn: "2024-01-06", updatedBy: "Sarah Wilson" },
  { id: "10", provider: "Qube Wire", agentOsName: "KDM Agent", latestVersion: "v4.5.6", updatedOn: "2024-01-14", updatedBy: "System" },
  { id: "11", provider: "Qube Wire", agentOsName: "Inventory Agent", latestVersion: "v1.2.3", updatedOn: "2024-01-04", updatedBy: "John Doe" },
  { id: "12", provider: "Qube Wire", agentOsName: "TDL Agent", latestVersion: "v0.12", updatedOn: "2024-01-03", updatedBy: "Admin" },
  { id: "13", provider: "Qube Wire", agentOsName: "Configuration Agent", latestVersion: "v0.8", updatedOn: "2024-01-02", updatedBy: "Jane Smith" },
  { id: "14", provider: "Qube Wire", agentOsName: "Live Wire", latestVersion: "v1.0.0", updatedOn: "2024-01-01", updatedBy: "System" },
  { id: "15", provider: "Scheduler", agentOsName: "Scheduler Agent", latestVersion: "v1.10.1", updatedOn: "2024-01-15", updatedBy: "Mike Johnson" },
  { id: "16", provider: "Scheduler", agentOsName: "Content Agent", latestVersion: "v2", updatedOn: "2024-01-10", updatedBy: "Admin" },
  { id: "17", provider: "Scheduler", agentOsName: "AgentQS", latestVersion: "v2.1", updatedOn: "2024-01-09", updatedBy: "System" },
  { id: "18", provider: "Slate", agentOsName: "AgentQ", latestVersion: "v6.9.56", updatedOn: "2024-01-08", updatedBy: "Sarah Wilson" },
];

/** Short provider label used in the task dialogs' agent picker ("QW - KDM Agent"). */
export const PROVIDER_SHORT_NAMES: Record<string, string> = {
  iCount: "iCount",
  Qlog: "QLog",
  "Qube Wire": "QW",
  Scheduler: "Scheduler",
  Slate: "Slate",
};

export interface SeedVersion extends Omit<VersionItem, "id"> {
  imageId: string;
}

/** WireOS's hand-written version history (what Manage Versions showed). */
const wireOsVersions: Omit<VersionItem, "id">[] = [
  { version: "v4.2.0", releaseDate: "2024-01-15T10:30:00Z", status: "stable", imageUrl: "https://registry.example.com/images/agent-os/v4.2.0", releaseNotes: "Added support for new hardware configurations.\nImproved performance by 15%.", internalNotes: "Tested on 50 devices. Ready for production.", addedOn: "2024-01-15T10:30:00Z", addedBy: "John Smith", isDefault: true },
  { version: "v4.1.9", releaseDate: "2024-01-10T14:15:00Z", status: "stable", imageUrl: "https://registry.example.com/images/agent-os/v4.1.9", releaseNotes: "Bug fixes and stability improvements.", internalNotes: "Patch release for v4.1.8 issues.", addedOn: "2024-01-10T14:15:00Z", addedBy: "Jane Doe" },
  { version: "v4.1.8", releaseDate: "2024-01-05T09:00:00Z", status: "stable", imageUrl: "https://registry.example.com/images/agent-os/v4.1.8", releaseNotes: "Minor updates and security patches.", internalNotes: "", addedOn: "2024-01-05T09:00:00Z", addedBy: "Mike Johnson" },
  { version: "v4.1.7", releaseDate: "2023-12-20T16:45:00Z", status: "deprecated", imageUrl: "https://registry.example.com/images/agent-os/v4.1.7", releaseNotes: "Feature release with new monitoring capabilities.", internalNotes: "Superseded by v4.1.8", addedOn: "2023-12-20T16:45:00Z", addedBy: "Sarah Wilson", deprecatedOn: "2024-01-05T09:30:00Z", deprecationNotes: "Contains known memory leak issue. Upgrade to v4.1.8 or later.", deprecatedBy: "Mike Johnson" },
  { version: "v4.1.6", releaseDate: "2023-12-15T11:20:00Z", status: "deprecated", imageUrl: "https://registry.example.com/images/agent-os/v4.1.6", releaseNotes: "Initial release for Q4 2023.", internalNotes: "", addedOn: "2023-12-15T11:20:00Z", addedBy: "John Smith", deprecatedOn: "2023-12-20T17:00:00Z", deprecationNotes: "Replaced by v4.1.7 with additional features.", deprecatedBy: "Sarah Wilson" },
  { version: "v4.1.5", releaseDate: "2023-12-10T08:00:00Z", status: "deprecated", imageUrl: "https://registry.example.com/images/agent-os/v4.1.5", releaseNotes: "Performance improvements.", internalNotes: "", addedOn: "2023-12-10T08:00:00Z", addedBy: "Jane Doe", deprecatedOn: "2023-12-15T12:00:00Z", deprecationNotes: "Replaced by v4.1.6.", deprecatedBy: "John Smith" },
  { version: "v4.1.4", releaseDate: "2023-12-01T14:30:00Z", status: "deprecated", imageUrl: "https://registry.example.com/images/agent-os/v4.1.4", releaseNotes: "Bug fixes.", internalNotes: "", addedOn: "2023-12-01T14:30:00Z", addedBy: "Mike Johnson", deprecatedOn: "2023-12-10T09:00:00Z", deprecationNotes: "Replaced by v4.1.5.", deprecatedBy: "Jane Doe" },
  { version: "v4.1.3", releaseDate: "2023-11-25T10:00:00Z", status: "deprecated", imageUrl: "https://registry.example.com/images/agent-os/v4.1.3", releaseNotes: "Initial Q4 release.", internalNotes: "", addedOn: "2023-11-25T10:00:00Z", addedBy: "Sarah Wilson", deprecatedOn: "2023-12-01T15:00:00Z", deprecationNotes: "Replaced by v4.1.4.", deprecatedBy: "Mike Johnson" },
];

const RELEASE_NOTES = [
  "Bug fixes and stability improvements.",
  "Minor updates and security patches.",
  "Performance improvements.",
  "Feature release with new monitoring capabilities.",
  "Improved logging and diagnostics.",
  "Initial release.",
];
const VERSION_AUTHORS = ["John Smith", "Jane Doe", "Mike Johnson", "Sarah Wilson"];

/** "v3.14.21" → "v3.14.20", "v1.0.0" → "v0.9.9", "v2" → "v1"; null below zero. */
function previousVersion(version: string): string | null {
  const parts = version.replace(/^v/, "").split(".").map(Number);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i] > 0) {
      parts[i]--;
      return `v${parts.join(".")}`;
    }
    parts[i] = 9;
  }
  return null;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const DAY = 86_400_000;

/** Version history per image: newest is default; the two oldest are deprecated. */
export function generateImageVersions(): SeedVersion[] {
  return fleetImages.flatMap((image) => {
    if (image.id === "1") return wireOsVersions.map((v) => ({ ...v, imageId: image.id }));
    const list: string[] = [image.latestVersion];
    while (list.length < 6) {
      const prev = previousVersion(list[list.length - 1]);
      if (!prev) break;
      list.push(prev);
    }
    const newest = Date.parse(`${image.updatedOn}T10:00:00Z`);
    return list.map((version, i) => {
      const released = new Date(newest - i * 12 * DAY).toISOString();
      const deprecated = list.length >= 4 && i >= list.length - 2;
      const author = VERSION_AUTHORS[(Number(image.id) + i) % VERSION_AUTHORS.length];
      return {
        imageId: image.id,
        version,
        releaseDate: released,
        status: deprecated ? "deprecated" : "stable",
        imageUrl: `https://registry.example.com/images/${slug(image.agentOsName)}/${version}`,
        releaseNotes: RELEASE_NOTES[(Number(image.id) + i) % RELEASE_NOTES.length],
        internalNotes: i === 0 ? "Tested on pilot sites. Ready for production." : "",
        addedOn: released,
        addedBy: author,
        isDefault: i === 0,
        ...(deprecated
          ? {
              deprecatedOn: new Date(newest - (i - 1) * 12 * DAY + 3_600_000).toISOString(),
              deprecationNotes: `Replaced by ${list[i - 1]}.`,
              deprecatedBy: VERSION_AUTHORS[(Number(image.id) + i + 1) % VERSION_AUTHORS.length],
            }
          : {}),
      };
    });
  });
}

export interface SeedImageLog extends Omit<ImageLog, "id"> {
  imageId: string;
}

/** Activity log per image, derived from its version history (what View Logs showed). */
export function generateImageLogs(versions: SeedVersion[]): SeedImageLog[] {
  const byImage = new Map<string, SeedVersion[]>();
  versions.forEach((v) => byImage.set(v.imageId, [...(byImage.get(v.imageId) ?? []), v]));
  return fleetImages.flatMap((image) => {
    const vs = byImage.get(image.id) ?? [];
    const [latest, second, third] = vs;
    const deprecated = vs.find((v) => v.status === "deprecated");
    const at = (iso: string, minutes: number) => new Date(Date.parse(iso) + minutes * 60_000).toISOString();
    const logs: SeedImageLog[] = [];
    if (latest) {
      logs.push({ imageId: image.id, timestamp: at(latest.addedOn, 2), action: "Version Added", details: `Added ${latest.version}`, user: latest.addedBy, status: "success" });
      logs.push({ imageId: image.id, timestamp: at(latest.addedOn, 0), action: "Build Started", details: `Building ${latest.version}`, user: "System", status: "info" });
    }
    if (second) {
      logs.push({ imageId: image.id, timestamp: at(second.addedOn, 5), action: "Version Updated", details: `Set ${second.version} as latest`, user: second.addedBy, status: "success" });
      logs.push({ imageId: image.id, timestamp: at(second.addedOn, 0), action: "Version Added", details: `Added ${second.version}`, user: second.addedBy, status: "success" });
    }
    if (deprecated?.deprecatedOn) {
      logs.push({ imageId: image.id, timestamp: deprecated.deprecatedOn, action: "Version Deprecated", details: `Deprecated ${deprecated.version}`, user: deprecated.deprecatedBy ?? "Admin", status: "warning" });
    }
    if (third) {
      logs.push({ imageId: image.id, timestamp: at(third.addedOn, 60 * 24), action: "Download", details: `${third.version} downloaded by 15 devices`, user: "System", status: "info" });
      logs.push({ imageId: image.id, timestamp: at(third.addedOn, -60 * 48), action: "Build Failed", details: `Failed to build ${third.version}-beta`, user: "System", status: "error" });
      logs.push({ imageId: image.id, timestamp: at(third.addedOn, -60 * 72), action: "Configuration Changed", details: "Updated build parameters", user: "Jane Smith", status: "info" });
    }
    return logs;
  });
}

// ---------------------------------------------------------------------------
// Nodes (appliances) and their installed images
// ---------------------------------------------------------------------------

export interface SeedNode {
  id: string;
  nodeId: string;
  applianceSerialNumber: string;
  hardwareSerialNumber: string;
  clusterName: string;
  /** Link to theatres.id when a theatre with this name exists (resolved by the seeder). */
  theatreName: string;
  theatreCode: string;
  chainName: string;
  city: string;
  state: string;
  country: string;
  address: string;
  alternateNames: string[];
  theatreUuid: string;
  chainAddress: FleetLocation;
}

/** The hand-picked appliances the Add Appliance dialog searched over. */
const namedAppliances: Omit<SeedNode, "id" | "theatreCode" | "address" | "alternateNames" | "theatreUuid">[] = [
  { nodeId: "NODE-001", applianceSerialNumber: "QWA-L28038", hardwareSerialNumber: "HWS-L28038", clusterName: "Cluster Alpha", theatreName: "AMC Empire 25", city: "New York", state: "NY", country: "USA", chainName: "AMC Theatres", chainAddress: { city: "Leawood", state: "KS", country: "USA" } },
  { nodeId: "NODE-002", applianceSerialNumber: "QWA-M12304", hardwareSerialNumber: "HWS-M12304", clusterName: "Cluster Beta", theatreName: "Regal LA Live", city: "Los Angeles", state: "CA", country: "USA", chainName: "Regal Cinemas", chainAddress: { city: "Knoxville", state: "TN", country: "USA" } },
  { nodeId: "NODE-003", applianceSerialNumber: "QWA-T23893", hardwareSerialNumber: "HWS-T23893", clusterName: "Cluster Gamma", theatreName: "Cinemark XD", city: "Dallas", state: "TX", country: "USA", chainName: "Cinemark", chainAddress: { city: "Plano", state: "TX", country: "USA" } },
  { nodeId: "NODE-004", applianceSerialNumber: "QWA-L45678", hardwareSerialNumber: "HWS-L45678", clusterName: "Cluster Delta", theatreName: "Marcus Theatres", city: "Milwaukee", state: "WI", country: "USA", chainName: "Marcus Corporation", chainAddress: { city: "Milwaukee", state: "WI", country: "USA" } },
  { nodeId: "NODE-005", applianceSerialNumber: "QWA-M98765", hardwareSerialNumber: "HWS-M98765", clusterName: "Cluster Epsilon", theatreName: "Alamo Drafthouse", city: "Austin", state: "TX", country: "USA", chainName: "Alamo Drafthouse Cinema", chainAddress: { city: "Austin", state: "TX", country: "USA" } },
  { nodeId: "NODE-006", applianceSerialNumber: "QWA-T11111", hardwareSerialNumber: "HWS-T11111", clusterName: "Cluster Alpha", theatreName: "Cinema City Metropolis", city: "New York", state: "NY", country: "USA", chainName: "Cinema City International", chainAddress: { city: "New York", state: "NY", country: "USA" } },
  { nodeId: "NODE-007", applianceSerialNumber: "QWA-L22222", hardwareSerialNumber: "HWS-L22222", clusterName: "Cluster Beta", theatreName: "Regal Cinema Downtown", city: "New York", state: "NY", country: "USA", chainName: "Regal Cinemas", chainAddress: { city: "Knoxville", state: "TN", country: "USA" } },
  { nodeId: "NODE-008", applianceSerialNumber: "QWA-M33333", hardwareSerialNumber: "HWS-M33333", clusterName: "Cluster Gamma", theatreName: "AMC Lincoln Square", city: "New York", state: "NY", country: "USA", chainName: "AMC Theatres", chainAddress: { city: "Leawood", state: "KS", country: "USA" } },
  { nodeId: "NODE-009", applianceSerialNumber: "QWA-T44444", hardwareSerialNumber: "HWS-T44444", clusterName: "Cluster Alpha", theatreName: "Alamo Drafthouse Brooklyn", city: "Brooklyn", state: "NY", country: "USA", chainName: "Alamo Drafthouse", chainAddress: { city: "Austin", state: "TX", country: "USA" } },
  { nodeId: "NODE-010", applianceSerialNumber: "QWA-L55555", hardwareSerialNumber: "HWS-L55555", clusterName: "Cluster Delta", theatreName: "Cinépolis Chelsea", city: "New York", state: "NY", country: "USA", chainName: "Cinépolis", chainAddress: { city: "New York", state: "NY", country: "USA" } },
];

/** Theatre facts the node generator places appliances in (the seeder reads these from `theatres`). */
export interface NodeTheatre {
  name: string;
  code: string | null;
  chainName: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

const CLUSTERS = ["Cluster Alpha", "Cluster Beta", "Cluster Gamma", "Cluster Delta", "Cluster Epsilon"];
const ALTERNATE_NAMES = [["GA Cinema", "Grand Theatre"], ["Metro Movies", "City Cinema"], ["Star Cinema", "Premium Theatre"], ["Galaxy Films", "Space Cinema"]];
const STREETS = ["Grand Ave", "Main St", "Broadway", "Cinema Blvd", "Theatre Way"];
const ZIPS = ["90012", "10001", "75201", "33101", "M5V 1J1", "SW1A 1AA"];
const SERIAL_PREFIXES = ["L", "M", "T"];

export const FLEET_NODE_COUNT = 250;

/**
 * 10 named appliances plus generated ones spread over `theatres`
 * (FLEET_NODE_COUNT in total). Deterministic for a given theatre list.
 */
export function generateFleetNodes(theatres: NodeTheatre[]): SeedNode[] {
  const rand = seededRandom(20240320);
  const uuid = () => {
    const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join("");
    return `${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(12)}`;
  };
  const address = (city: string, state: string) =>
    `${Math.floor(rand() * 999) + 1} ${pick(rand, STREETS)}, ${city}, ${state} ${pick(rand, ZIPS)}`;

  const nodes: SeedNode[] = namedAppliances.map((a, i) => ({
    ...a,
    id: `fn-${String(i + 1).padStart(4, "0")}`,
    theatreCode: `TH-${String(i + 1).padStart(4, "0")}`,
    address: address(a.city, a.state),
    alternateNames: pick(rand, ALTERNATE_NAMES),
    theatreUuid: uuid(),
  }));

  const pool = theatres.filter((t) => t.city);
  for (let i = nodes.length; i < FLEET_NODE_COUNT && pool.length; i++) {
    const t = pool[(i * 7) % pool.length];
    const serial = `${pick(rand, SERIAL_PREFIXES)}${String(30000 + i * 37).padStart(5, "0")}`;
    const city = t.city ?? "";
    const state = t.state ?? "";
    const country = t.country ?? "";
    nodes.push({
      id: `fn-${String(i + 1).padStart(4, "0")}`,
      nodeId: `NODE-${String(i + 1000).padStart(6, "0")}`,
      applianceSerialNumber: `QWA-${serial}`,
      hardwareSerialNumber: `HWS-${serial}`,
      clusterName: pick(rand, CLUSTERS),
      theatreName: t.name,
      theatreCode: t.code ?? `TH-${String(i + 1).padStart(4, "0")}`,
      chainName: t.chainName ?? "",
      city,
      state,
      country,
      address: address(city, state),
      alternateNames: pick(rand, ALTERNATE_NAMES),
      theatreUuid: uuid(),
      chainAddress: { city, state, country },
    });
  }
  return nodes;
}

export interface SeedNodeImage {
  nodeId: string; // fleet_nodes.id
  imageId: string;
  version: string;
  status: FleetNodeStatus;
  lastHeartbeat: string;
  lastUpdateTask: string | null;
}

/** Every node runs every image; ~80% active, versions spread over the image's history. */
export function generateNodeImages(nodes: SeedNode[], versions: SeedVersion[]): SeedNodeImage[] {
  const rand = seededRandom(7);
  const statuses: FleetNodeStatus[] = ["Active", "Inactive", "Unresponsive"];
  return fleetImages.flatMap((image) => {
    const imageVersions = versions.filter((v) => v.imageId === image.id).map((v) => v.version);
    return nodes.map((node, i) => ({
      nodeId: node.id,
      imageId: image.id,
      version: pick(rand, imageVersions),
      status: statuses[Math.floor(rand() * (i < 200 ? 1 : 3))],
      lastHeartbeat: new Date(FLEET_SEED_NOW - Math.floor(rand() * DAY * 7)).toISOString(),
      lastUpdateTask: rand() > 0.5 ? `FT-${String(Math.floor(rand() * 6) + 1).padStart(3, "0")}` : null,
    }));
  });
}

// ---------------------------------------------------------------------------
// Tasks, targets and attempt logs
// ---------------------------------------------------------------------------

export interface SeedTask extends Omit<FleetTask, "id" | "affectedDevices" | "selectedAgent" | "agentName"> {
  id: string;
  imageId: string | null;
  /** How many appliances the task targets. */
  affectedDevices: number;
}

export const fleetTasks: SeedTask[] = [
  { id: "1", taskId: "FT-001", taskType: "WireOS Update", triggerDate: "2024-01-15 10:00", triggerTimezone: "UTC", description: "Update WireOS to v4.2.0 for all devices in Region A", createdBy: "John Doe", createdOn: "2024-01-10", status: "Scheduled", targetVersion: "v4.2.0", affectedDevices: 45, imageId: "1" },
  { id: "2", taskId: "FT-002", taskType: "Agent Update", triggerDate: "2024-01-12 14:30", triggerTimezone: "EST", description: "Update Manifest Agent to v4.0.0", createdBy: "Jane Smith", createdOn: "2024-01-08", status: "In Progress", targetVersion: "v4.0.0", affectedDevices: 120, imageId: "8" },
  { id: "3", taskId: "FT-003", taskType: "PartnerOS Update", triggerDate: "2024-01-20 08:00", triggerTimezone: "PST", description: "Upgrade PartnerOS to latest version", createdBy: "Mike Johnson", createdOn: "2024-01-11", status: "Scheduled", targetVersion: "v3.12.14", affectedDevices: 30, imageId: "3" },
  { id: "4", taskId: "FT-004", taskType: "Others", triggerDate: "2024-01-05 16:00", triggerTimezone: "UTC", description: "Restart all devices in Theatre Group B", createdBy: "Sarah Wilson", createdOn: "2024-01-03", status: "Completed", affectedDevices: 25, imageId: null },
  { id: "5", taskId: "FT-005", taskType: "WireOS Update", triggerDate: "2024-01-08 11:00", triggerTimezone: "CST", description: "Emergency security patch for WireOS", createdBy: "John Doe", createdOn: "2024-01-07", status: "Failed", targetVersion: "v4.1.9", affectedDevices: 15, imageId: "1" },
  { id: "6", taskId: "FT-006", taskType: "Agent Update", triggerDate: "2024-01-18 09:00", triggerTimezone: "UTC", description: "Update KDM Agent across all regions", createdBy: "Jane Smith", createdOn: "2024-01-12", status: "Cancelled", targetVersion: "v4.5.6", affectedDevices: 200, imageId: "10" },
];

/** Attempt histories the Task View page showed, reused as templates. */
const ATTEMPT_TEMPLATES: Record<"Completed" | "In Progress" | "Failed", { minutes: number; status: "Success" | "Failed"; message: string }[][]> = {
  Completed: [[{ minutes: 0, status: "Success", message: "Update completed successfully" }]],
  "In Progress": [
    [{ minutes: 0, status: "Failed", message: "Connection timeout" }, { minutes: 5, status: "Failed", message: "Package verification failed" }],
    [{ minutes: 0, status: "Failed", message: "Network error" }, { minutes: 8, status: "Failed", message: "Retrying..." }],
  ],
  Failed: [[
    { minutes: 0, status: "Failed", message: "Connection timeout" },
    { minutes: 10, status: "Failed", message: "Disk space insufficient" },
    { minutes: 20, status: "Failed", message: "Connection refused" },
    { minutes: 30, status: "Failed", message: "Service unavailable" },
    { minutes: 40, status: "Failed", message: "Maximum retries exceeded" },
    { minutes: 50, status: "Failed", message: "Final attempt failed - marked as failed" },
  ]],
};

export interface SeedTaskTarget {
  taskId: string;
  nodeId: string; // fleet_nodes.id
  updateStatus: ApplianceUpdateStatus;
  addedOn: string;
  updatedOn: string | null;
  attemptLogs: AttemptLog[];
}

/** Targets per task with statuses that fit the task's own status. */
export function generateTaskTargets(nodes: SeedNode[]): SeedTaskTarget[] {
  const rand = seededRandom(42);
  return fleetTasks.flatMap((task, taskIndex) => {
    const start = Date.parse(`${task.triggerDate.replace(" ", "T")}:00Z`);
    const added = new Date(Date.parse(`${task.createdOn}T09:00:00Z`)).toISOString();
    const count = Math.min(task.affectedDevices, nodes.length);
    const offset = (taskIndex * 37) % nodes.length;
    return Array.from({ length: count }, (_, i) => {
      const node = nodes[(offset + i) % nodes.length];
      let status: ApplianceUpdateStatus;
      switch (task.status) {
        case "Scheduled": status = "Pending"; break;
        case "Cancelled": status = "Cancelled"; break;
        case "Completed": status = "Completed"; break;
        case "Failed": status = rand() < 0.6 ? "Failed" : "Completed"; break;
        default: status = pick(rand, ["Completed", "Completed", "In Progress", "Failed", "Pending"] as ApplianceUpdateStatus[]);
      }
      const template = status === "Completed" || status === "In Progress" || status === "Failed" ? pick(rand, ATTEMPT_TEMPLATES[status]) : [];
      const jitter = Math.floor(rand() * 5);
      const attemptLogs: AttemptLog[] = template.map((a, n) => ({
        attemptNumber: n + 1,
        timestamp: new Date(start + (a.minutes + jitter) * 60_000).toISOString(),
        status: a.status,
        message: a.message,
      }));
      return {
        taskId: task.id,
        nodeId: node.id,
        updateStatus: status,
        addedOn: added,
        updatedOn: attemptLogs.length ? attemptLogs[attemptLogs.length - 1].timestamp : status === "Cancelled" ? added : null,
        attemptLogs,
      };
    });
  });
}
