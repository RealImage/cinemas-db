import type { SyncRunBase, SyncSourceState } from "./syncStatus";

/**
 * One device manufacturer's certificate FTP site (GET /tdl/sync-status). The FTP username and password live in the
 * Credentials Manager, not here.
 */
export interface TdlSyncSource extends SyncSourceState {
  manufacturer: string;
  ftpUrl: string;
  rootDir: string;
}

/** One certificate sync run (GET /tdl/sync-status/runs and /tdl/sync-status/:manufacturer/runs), newest first. */
export interface TdlSyncRun extends SyncRunBase {
  manufacturer: string;
  /** Certificate files on the FTP site to fetch: new or changed since the last sync, or all on a full sync. */
  filesFound: number;
  /** Certificates read from those files (zip / tar.gz files hold several). */
  certificatesParsed: number;
  devicesAdded: number;
  devicesUpdated: number;
  /** Rejected: expired, SHA-1, not a leaf certificate, model / serial mismatch. */
  invalidCertificates: number;
}
