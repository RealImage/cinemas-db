/** A sync run's outcome; a source that has never run is "Never". */
export type FlmSyncRunStatus = "Success" | "Partial" | "Failed" | "Running";
export type FlmSyncStatusValue = FlmSyncRunStatus | "Never";

export const FLM_SYNC_RUN_STATUSES: FlmSyncRunStatus[] = ["Success", "Partial", "Failed", "Running"];

/** One FLM provider's sync source (GET /flm/sync-status). Credentials live in the Credentials Manager, not here. */
export interface FlmSyncSource {
  providerId: string;
  providerName: string;
  syncUrl: string;
  enabled: boolean;
  schedule: string;
  lastSyncedAt: string | null;
  lastStatus: FlmSyncStatusValue;
  lastMessage: string | null;
  updatedBy: string;
  updatedAt: string | null;
  runs24h: number;
  runs7d: number;
  failed7d: number;
}

/** One sync run (GET /flm/sync-status/runs and /flm/sync-status/:providerId/runs), newest first. */
export interface FlmSyncRun {
  id: string;
  providerId: string;
  providerName: string;
  startedAt: string;
  finishedAt: string | null;
  status: FlmSyncRunStatus;
  theatresReceived: number;
  theatresUpdated: number;
  theatresNew: number;
  errors: number;
  message: string | null;
  triggeredBy: string;
}
