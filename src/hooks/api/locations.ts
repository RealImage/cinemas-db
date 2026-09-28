import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  LocationEntity,
  LocationInputMap,
  LocationListParams,
  LocationLogEntry,
  LocationPage,
  LocationRecordMap,
  ReviewAction,
  ReviewItem,
  ReviewItemsParams,
  ReviewPrefill,
  ReviewSummary,
  SyncSettings,
  WithReviewItem,
} from "@/data/locationsData";

export const locationKeys = {
  all: ["locations"] as const,
  list: (entity: LocationEntity, params: LocationListParams) => [...locationKeys.all, entity, "list", params] as const,
  record: (entity: LocationEntity, id: string) => [...locationKeys.all, entity, "record", id] as const,
  logs: (entity: LocationEntity, id: string) => [...locationKeys.all, entity, "logs", id] as const,
  review: ["locations", "review"] as const,
};

const qs = (params: object) => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "" && v !== false) search.set(k, String(v));
  const s = search.toString();
  return s ? `?${s}` : "";
};

export const useLocationList = <E extends LocationEntity>(entity: E, params: LocationListParams, enabled = true) =>
  useQuery({
    queryKey: locationKeys.list(entity, params),
    queryFn: () => api.get<LocationPage<LocationRecordMap[E]>>(`/locations/${entity}${qs(params)}`),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useLocationRecord = <E extends LocationEntity>(entity: E, id: string | undefined) =>
  useQuery({
    queryKey: locationKeys.record(entity, id ?? ""),
    queryFn: () => api.get<LocationRecordMap[E]>(`/locations/${entity}/${encodeURIComponent(id!)}`),
    enabled: !!id,
  });

export const useLocationLogs = (entity: LocationEntity, id: string | undefined) =>
  useQuery({
    queryKey: locationKeys.logs(entity, id ?? ""),
    queryFn: () => api.get<LocationLogEntry[]>(`/locations/${entity}/${encodeURIComponent(id!)}/logs`),
    enabled: !!id,
  });

/** Any location change can move counts, labels and review items across entities; refetch them all. */
const useInvalidateLocations = () => {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: locationKeys.all });
    // Theatres carry city/state/country text that follows their city
    qc.invalidateQueries({ queryKey: ["theatres"] });
  };
};

export const useSaveLocation = <E extends LocationEntity>(entity: E) => {
  const invalidate = useInvalidateLocations();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: WithReviewItem<LocationInputMap[E]> }) =>
      id
        ? api.put<LocationRecordMap[E]>(`/locations/${entity}/${encodeURIComponent(id)}`, input)
        : api.post<LocationRecordMap[E]>(`/locations/${entity}`, input),
    onSuccess: invalidate,
  });
};

export const useSetLocationDeleted = (entity: LocationEntity) => {
  const invalidate = useInvalidateLocations();
  return useMutation({
    mutationFn: ({ id, deleted }: { id: string; deleted: boolean }) =>
      api.post(`/locations/${entity}/${encodeURIComponent(id)}/${deleted ? "deactivate" : "restore"}`),
    onSuccess: invalidate,
  });
};

// ---------------------------------------------------------------------------
// Reference sync review
// ---------------------------------------------------------------------------

export const useReviewSummary = () =>
  useQuery({
    queryKey: [...locationKeys.review, "summary"],
    queryFn: () => api.get<ReviewSummary>("/locations/review/summary"),
    // Poll while a run is in progress
    refetchInterval: (q) => (q.state.data?.running ? 2000 : false),
  });

export const useReviewItems = (params: ReviewItemsParams) =>
  useQuery({
    queryKey: [...locationKeys.review, "items", params],
    queryFn: () => api.get<LocationPage<ReviewItem>>(`/locations/review/items${qs(params)}`),
    placeholderData: keepPreviousData,
  });

export const useReviewDecisions = (page: number, pageSize: number) =>
  useQuery({
    queryKey: [...locationKeys.review, "decisions", page, pageSize],
    queryFn: () => api.get<LocationPage<LocationLogEntry>>(`/locations/review/decisions?page=${page}&pageSize=${pageSize}`),
    placeholderData: keepPreviousData,
  });

export const fetchReviewPrefill = (itemId: number) => api.get<ReviewPrefill>(`/locations/review/items/${itemId}/prefill`);

export const useReviewPrefill = (itemId: number | null) =>
  useQuery({
    queryKey: [...locationKeys.review, "prefill", itemId],
    queryFn: () => fetchReviewPrefill(itemId!),
    enabled: itemId != null,
    staleTime: Infinity,
  });

export const useDecideReviewItem = () => {
  const invalidate = useInvalidateLocations();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: ReviewAction | { action: "add" } }) =>
      api.post<ReviewItem>(`/locations/review/items/${id}`, action),
    onSuccess: invalidate,
  });
};

export const useRunSync = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ runId: number }>("/locations/review/run"),
    onSuccess: () => qc.invalidateQueries({ queryKey: locationKeys.review }),
  });
};

export const useSaveSyncSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Pick<SyncSettings, "trackedCountryIds" | "populationThreshold" | "nightlyEnabled">) =>
      api.put<SyncSettings>("/locations/review/settings", settings),
    onSuccess: () => qc.invalidateQueries({ queryKey: locationKeys.review }),
  });
};
