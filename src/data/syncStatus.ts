/** A sync run's outcome; a source that has never run is "Never". Shared by the FLM and TDL sync status pages. */
export type SyncRunStatus = "Success" | "Partial" | "Failed" | "Running";
export type SyncStatusValue = SyncRunStatus | "Never";

export const SYNC_RUN_STATUSES: SyncRunStatus[] = ["Success", "Partial", "Failed", "Running"];

/** A sync source's last outcome and recent run counts, as both sync-status endpoints return them. */
export interface SyncSourceState {
  enabled: boolean;
  schedule: string;
  lastSyncedAt: string | null;
  lastStatus: SyncStatusValue;
  lastMessage: string | null;
  updatedBy: string;
  updatedAt: string | null;
  runs24h: number;
  runs7d: number;
  failed7d: number;
}

/** Fields every sync run has, whatever it syncs. */
export interface SyncRunBase {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: SyncRunStatus;
  errors: number;
  message: string | null;
  triggeredBy: string;
}
