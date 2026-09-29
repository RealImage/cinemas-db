import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Company, DashboardStats, Theatre } from "@/types";
import type { WireTAPDevice } from "@/types/wireTAP";
import type { WtfData } from "@/data/wtfData";
import type { TheatreFacets, TheatrePage, TheatreSearchMode, TheatreTag } from "@/data/theatreSearch";

export const theatreKeys = {
  all: ["theatres"] as const,
  list: (withScreens = false) => ["theatres", "list", withScreens ? "with-screens" : "summary"] as const,
  detail: (id: string) => ["theatres", "detail", id] as const,
  logs: (id: string) => ["theatres", "logs", id] as const,
  wiretap: (id: string) => ["theatres", "wiretap", id] as const,
  companies: ["theatres", "companies"] as const,
  stats: ["theatres", "stats"] as const,
  page: (query: string) => ["theatres", "page", query] as const,
  facets: ["theatres", "facets"] as const,
};

export type TheatreLogEntry = {
  id: string;
  date: string;
  section: "General Information" | "Location & Systems" | "Connectivity Details" | "Content & Key Delivery" | "Screen Management" | "IP & Suites";
  action: "Created" | "Updated" | "Listed" | "Unlisted" | "Deleted";
  updatedBy: { name: string; email?: string; phone?: string };
  oldValue?: string | null;
  newValue?: string | null;
};

/** All theatres; `withScreens` nests every theatre's screens (larger payload). */
export const useTheatres = ({ withScreens = false } = {}) =>
  useQuery({
    queryKey: theatreKeys.list(withScreens),
    queryFn: () => api.get<Theatre[]>(`/theatres${withScreens ? "?include=screens" : ""}`),
  });

export interface TheatrePageParams {
  page: number;
  pageSize: number;
  q: string;
  mode: TheatreSearchMode;
  sort?: string;
  dir?: "asc" | "desc";
  /** Column filters: status, listing, chain, company. */
  filters: Record<string, string>;
  tags: TheatreTag[];
}

/** One page of the Theatre List, searched, filtered and sorted on the server. */
export const useTheatrePage = (p: TheatrePageParams) => {
  const qs = new URLSearchParams({ page: String(p.page), pageSize: String(p.pageSize), mode: p.mode });
  if (p.q.trim()) qs.set("q", p.q.trim());
  if (p.sort && p.dir) { qs.set("sort", p.sort); qs.set("dir", p.dir); }
  for (const [name, value] of Object.entries(p.filters)) qs.append(name, value);
  for (const tag of p.tags) qs.append("tag", `${tag.kind}:${tag.value}`);
  return useQuery({
    queryKey: theatreKeys.page(qs.toString()),
    queryFn: () => api.get<TheatrePage>(`/theatres/page?${qs}`),
    placeholderData: keepPreviousData,
  });
};

export const useTheatreFacets = () =>
  useQuery({ queryKey: theatreKeys.facets, queryFn: () => api.get<TheatreFacets>("/theatres/facets") });

export const useTheatre = (id: string | undefined) =>
  useQuery({
    queryKey: theatreKeys.detail(id ?? ""),
    queryFn: () => api.get<Theatre>(`/theatres/${id}`),
    enabled: !!id,
  });

export const useTheatreLogs = (id: string | undefined) =>
  useQuery({
    queryKey: theatreKeys.logs(id ?? ""),
    queryFn: () => api.get<TheatreLogEntry[]>(`/theatres/${id}/logs`),
    enabled: !!id,
  });

export const useCompanies = () =>
  useQuery({ queryKey: theatreKeys.companies, queryFn: () => api.get<Company[]>("/theatres/companies") });

export const useDashboardStats = () =>
  useQuery({ queryKey: theatreKeys.stats, queryFn: () => api.get<DashboardStats>("/theatres/stats") });

/** Invalidate everything derived from theatres (lists, details, dashboards, FLM matches, approvals counts). */
const useInvalidateTheatres = () => {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: theatreKeys.all });
    qc.invalidateQueries({ queryKey: ["approvals"] });
    qc.invalidateQueries({ queryKey: ["chains"] });
  };
};

export const useCreateTheatre = () => {
  const invalidate = useInvalidateTheatres();
  return useMutation({
    mutationFn: (theatre: Partial<Theatre>) => api.post<Theatre>("/theatres", theatre),
    onSuccess: invalidate,
  });
};

export const useUpdateTheatre = () => {
  const invalidate = useInvalidateTheatres();
  return useMutation({
    mutationFn: ({ id, ...theatre }: Partial<Theatre> & { id: string }) => api.put<Theatre>(`/theatres/${id}`, theatre),
    onSuccess: invalidate,
  });
};

export const useSetTheatreStatus = () => {
  const invalidate = useInvalidateTheatres();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Theatre["status"] }) =>
      api.patch<Theatre>(`/theatres/${id}/status`, { status }),
    onSuccess: invalidate,
  });
};

export const useDeleteTheatre = () => {
  const invalidate = useInvalidateTheatres();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/theatres/${id}`),
    onSuccess: invalidate,
  });
};

// WireTAP devices at a theatre ------------------------------------------------

export const useTheatreWireTAPDevices = (theatreId: string | undefined) =>
  useQuery({
    queryKey: theatreKeys.wiretap(theatreId ?? ""),
    queryFn: () => api.get<WireTAPDevice[]>(`/theatres/${theatreId}/wiretap-devices`),
    enabled: !!theatreId,
  });

export type WireTAPSearchField = "applicationSerialNumber" | "hardwareSerialNumber" | "hostName";

export const searchWireTAPDevice = async (by: WireTAPSearchField, q: string) => {
  const params = new URLSearchParams({ by, q });
  const [device] = await api.get<WireTAPDevice[]>(`/theatres/wiretap-devices/search?${params}`);
  return device ?? null;
};

const useInvalidateWireTAP = (theatreId: string) => {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: theatreKeys.all });
    qc.invalidateQueries({ queryKey: ["wiretap"] });
    qc.invalidateQueries({ queryKey: theatreKeys.wiretap(theatreId) });
  };
};

export const useAddWireTAPToTheatre = (theatreId: string) => {
  const invalidate = useInvalidateWireTAP(theatreId);
  return useMutation({
    mutationFn: (deviceId: string) => api.post<WireTAPDevice>(`/theatres/${theatreId}/wiretap-devices`, { deviceId }),
    onSuccess: invalidate,
  });
};

export const usePullOutWireTAP = (theatreId: string) => {
  const invalidate = useInvalidateWireTAP(theatreId);
  return useMutation({
    mutationFn: ({ deviceId, reason, comments }: { deviceId: string; reason: string; comments: string }) =>
      api.post<WireTAPDevice>(`/theatres/${theatreId}/wiretap-devices/${deviceId}/pull-out`, { reason, comments }),
    onSuccess: invalidate,
  });
};

/** "What's This Facility": the read-only summary behind the View WTF panel. */
export const useTheatreWtf = (theatreId: string | undefined) =>
  useQuery({
    queryKey: ["theatres", "wtf", theatreId ?? ""],
    queryFn: () => api.get<WtfData>(`/wtf/${encodeURIComponent(theatreId!)}`),
    enabled: !!theatreId,
  });
