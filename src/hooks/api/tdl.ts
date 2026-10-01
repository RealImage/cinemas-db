import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TDLDevice } from "@/types";
import type { TdlSyncRun, TdlSyncSource } from "@/data/tdlSync";
import { SYNC_POLL_MS } from "@/data/syncStatus";

export const tdlKeys = {
  all: ["tdl"] as const,
  syncStatus: ["tdl-sync", "status"] as const,
  syncRuns: (manufacturer?: string) => ["tdl-sync", "runs", manufacturer ?? "all"] as const,
};

/** The whole Trusted Device List (~10k rows). */
export const useTDLDevices = () =>
  useQuery({ queryKey: tdlKeys.all, queryFn: () => api.get<TDLDevice[]>("/tdl"), staleTime: 60_000 });

/** Each manufacturer's certificate FTP site and last sync outcome. */
export const useTdlSyncStatus = () =>
  useQuery({
    queryKey: tdlKeys.syncStatus, queryFn: () => api.get<TdlSyncSource[]>("/tdl/sync-status"),
    refetchInterval: SYNC_POLL_MS,
  });

/** Certificate sync runs, newest first: every manufacturer's, or one manufacturer's. */
export const useTdlSyncRuns = (manufacturer?: string) =>
  useQuery({
    queryKey: tdlKeys.syncRuns(manufacturer),
    queryFn: () =>
      api.get<TdlSyncRun[]>(manufacturer ? `/tdl/sync-status/${encodeURIComponent(manufacturer)}/runs` : "/tdl/sync-status/runs"),
    refetchInterval: SYNC_POLL_MS,
  });

export const useRetireTDLDevice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<TDLDevice>(`/tdl/${id}/retire`),
    onSuccess: (device) => {
      qc.setQueryData<TDLDevice[]>(tdlKeys.all, (rows) => rows?.map((d) => (d.id === device.id ? device : d)));
      qc.invalidateQueries({ queryKey: ["approvals"] });
    },
  });
};
