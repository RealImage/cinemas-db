import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FlmFeed } from "@/data/flmFeedsData";
import type { FlmSyncRun, FlmSyncSource } from "@/data/flmSync";
import { theatreKeys } from "./theatres";

export const flmKeys = {
  all: ["flm"] as const,
  list: ["flm", "list"] as const,
  detail: (id: string) => ["flm", "detail", id] as const,
  syncStatus: ["flm", "sync-status"] as const,
  syncRuns: ["flm", "sync-status", "runs"] as const,
};

export type FlmFieldKey =
  | "sourceTheatreId" | "theatreUuid" | "name" | "displayName" | "address" | "city" | "state" | "country"
  | "postalCode" | "chain" | "timezone" | "contactName" | "phone" | "email";

export const useFlmFeeds = () => useQuery({ queryKey: flmKeys.list, queryFn: () => api.get<FlmFeed[]>("/flm") });

export const useFlmFeed = (id: string | undefined) =>
  useQuery({ queryKey: flmKeys.detail(id ?? ""), queryFn: () => api.get<FlmFeed>(`/flm/${id}`), enabled: !!id });

/** Syncs run on the server's schedule, so the status page polls; both queries share the interval to stay in step. */
const SYNC_POLL_MS = 60_000;

/** Each FLM provider's sync source and last outcome. */
export const useFlmSyncStatus = () =>
  useQuery({
    queryKey: flmKeys.syncStatus, queryFn: () => api.get<FlmSyncSource[]>("/flm/sync-status"),
    refetchInterval: SYNC_POLL_MS,
  });

/** Sync runs of every provider, newest first. */
export const useFlmSyncRuns = () =>
  useQuery({
    queryKey: flmKeys.syncRuns, queryFn: () => api.get<FlmSyncRun[]>("/flm/sync-status/runs"),
    refetchInterval: SYNC_POLL_MS,
  });

const useInvalidateFlm = () => {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: flmKeys.all });
    qc.invalidateQueries({ queryKey: theatreKeys.all });
    qc.invalidateQueries({ queryKey: ["approvals"] });
    qc.invalidateQueries({ queryKey: ["chains"] });
  };
};

/** Map a feed to an existing theatre, copying the selected incoming fields. */
export const useMapFlmFeed = () => {
  const invalidate = useInvalidateFlm();
  return useMutation({
    mutationFn: ({ feedId, theatreId, fields }: { feedId: string; theatreId: string; fields: FlmFieldKey[] }) =>
      api.post<{ theatreId: string }>(`/flm/${feedId}/map`, { theatreId, fields }),
    onSuccess: invalidate,
  });
};

export const useCreateTheatreFromFlmFeed = () => {
  const invalidate = useInvalidateFlm();
  return useMutation({
    mutationFn: (feedId: string) => api.post<{ theatreId: string }>(`/flm/${feedId}/create-theatre`),
    onSuccess: invalidate,
  });
};

export const useIgnoreFlmFeed = () => {
  const invalidate = useInvalidateFlm();
  return useMutation({
    mutationFn: (feedId: string) => api.post(`/flm/${feedId}/ignore`),
    onSuccess: invalidate,
  });
};

export const useMapFlmThirdPartyId = () => {
  const invalidate = useInvalidateFlm();
  return useMutation({
    mutationFn: ({ feedId, domain, externalId }: { feedId: string; domain: string; externalId: string }) =>
      api.post<{ mappedTo: "theatre" | "feed"; theatreId?: string }>(`/flm/${feedId}/third-party-ids`, { domain, externalId }),
    onSuccess: invalidate,
  });
};
