import type { SyncRunBase, SyncSourceState } from "./syncStatus";

/** One FLM provider's sync source (GET /flm/sync-status). Credentials live in the Credentials Manager, not here. */
export interface FlmSyncSource extends SyncSourceState {
  providerId: string;
  providerName: string;
  syncUrl: string;
}

/** One sync run (GET /flm/sync-status/runs and /flm/sync-status/:providerId/runs), newest first. */
export interface FlmSyncRun extends SyncRunBase {
  providerId: string;
  providerName: string;
  theatresReceived: number;
  theatresUpdated: number;
  theatresNew: number;
}
