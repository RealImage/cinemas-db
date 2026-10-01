import { useMemo } from "react";
import { motion } from "framer-motion";
import { QueryState } from "@/components/ui/query-state";
import { SyncStatusHeader } from "@/components/sync/SyncStatusHeader";
import { SyncSourceGrid, type SyncSourceCardData } from "@/components/sync/SyncSourceCard";
import { SyncLog } from "@/components/sync/SyncLog";
import { syncLogColumns, useSyncLogFilters } from "@/components/sync/syncLogColumns";
import { useFlmSyncRuns, useFlmSyncStatus } from "@/hooks/api/flm";
import type { FlmSyncRun, FlmSyncSource } from "@/data/flmSync";

const columns = syncLogColumns<FlmSyncRun>({ header: "Provider", accessor: "providerName" }, [
  { header: "Received", key: "theatresReceived" },
  { header: "Updated", key: "theatresUpdated" },
  { header: "New", key: "theatresNew" },
]);

const toCard = (s: FlmSyncSource): SyncSourceCardData => ({ ...s, id: s.providerId, name: s.providerName, url: s.syncUrl });

const FLMSyncStatus = () => {
  const statusQuery = useFlmSyncStatus();
  const runsQuery = useFlmSyncRuns();
  const { rows, ...filters } = useSyncLogFilters(runsQuery.data, "providerId");
  const providers = useMemo(() => (statusQuery.data ?? []).map((p) => ({ id: p.providerId, name: p.providerName })), [statusQuery.data]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-6">
      <SyncStatusHeader backTo="/theatres/flm-feeds" backLabel="FLM Feeds">
        Each FLM provider's feed: where it syncs from, its schedule and how its recent syncs went.
      </SyncStatusHeader>

      <QueryState query={statusQuery} label="sync status">
        {(sources) => (
          <SyncSourceGrid
            sources={sources.map(toCard)}
            selected={filters.source}
            onSelect={filters.toggleSource}
            urlLabel="Sync URL"
            noun="provider"
          />
        )}
      </QueryState>

      <SyncLog
        id="flm-sync-log"
        query={runsQuery}
        filters={filters}
        rows={rows}
        columns={columns}
        sources={providers}
        sourceLabel="Provider"
        sourcesLabel="providers"
        searchPlaceholder="Search messages, providers..."
        exportName="FLM sync log"
      />
    </motion.div>
  );
};

export default FLMSyncStatus;
