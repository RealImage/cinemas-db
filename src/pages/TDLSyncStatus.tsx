import { useMemo } from "react";
import { motion } from "framer-motion";
import { QueryState } from "@/components/ui/query-state";
import { SyncStatusHeader } from "@/components/sync/SyncStatusHeader";
import { SyncSourceGrid, type SyncSourceCardData } from "@/components/sync/SyncSourceCard";
import { SyncLog } from "@/components/sync/SyncLog";
import { syncLogColumns, useSyncLogFilters } from "@/components/sync/syncLogColumns";
import { useTdlSyncRuns, useTdlSyncStatus } from "@/hooks/api/tdl";
import type { TdlSyncRun, TdlSyncSource } from "@/data/tdlSync";

const columns = syncLogColumns<TdlSyncRun>({ header: "Manufacturer", accessor: "manufacturer" }, [
  { header: "Files", key: "filesFound" },
  { header: "Parsed", key: "certificatesParsed" },
  { header: "Added", key: "devicesAdded" },
  { header: "Updated", key: "devicesUpdated" },
  { header: "Invalid", key: "invalidCertificates", tone: "notice" },
]);

const toCard = (s: TdlSyncSource): SyncSourceCardData => ({
  ...s,
  id: s.manufacturer,
  name: s.manufacturer,
  url: s.ftpUrl,
  urlDetail: { label: "Root dir", value: s.rootDir },
});

const TDLSyncStatus = () => {
  const statusQuery = useTdlSyncStatus();
  const runsQuery = useTdlSyncRuns();
  const { rows, ...filters } = useSyncLogFilters(runsQuery.data, "manufacturer");
  const manufacturers = useMemo(() => (statusQuery.data ?? []).map((m) => ({ id: m.manufacturer, name: m.manufacturer })), [statusQuery.data]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <SyncStatusHeader backTo="/theatre-device-management/tdl-devices" backLabel="TDL Devices">
        New devices are added from device certificates that manufacturers share on their FTP sites.
      </SyncStatusHeader>

      <QueryState query={statusQuery} label="sync status">
        {(sources) => (
          <SyncSourceGrid
            sources={sources.map(toCard)}
            selected={filters.source}
            onSelect={filters.toggleSource}
            urlLabel="FTP site"
            noun="manufacturer"
          />
        )}
      </QueryState>

      <SyncLog
        id="tdl-sync-log"
        query={runsQuery}
        filters={filters}
        rows={rows}
        columns={columns}
        sources={manufacturers}
        sourceLabel="Manufacturer"
        sourcesLabel="manufacturers"
        searchPlaceholder="Search messages, manufacturers..."
        exportName="TDL sync log"
      />
    </motion.div>
  );
};

export default TDLSyncStatus;
