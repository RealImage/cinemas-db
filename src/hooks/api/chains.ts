import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Chain } from "@/types";
import type {
  CallingCode, ChainDetails, ChainDetailsInput, ChainDeviceCredentials, ChainLogEntry, ChainSystems, ChainTheatre,
} from "@/data/chainDetails";

export const chainKeys = {
  all: ["chains"] as const,
  detail: (id: string) => [...chainKeys.all, "detail", id] as const,
  part: (id: string, part: "systems" | "device-credentials" | "theatres" | "logs") => [...chainKeys.all, "detail", id, part] as const,
  callingCodes: ["chains", "calling-codes"] as const,
};

export const useChains = () => useQuery({ queryKey: chainKeys.all, queryFn: () => api.get<Chain[]>("/chains") });

export const useChain = (id: string | undefined) =>
  useQuery({ queryKey: chainKeys.detail(id ?? ""), queryFn: () => api.get<ChainDetails>(`/chains/${id}`), enabled: !!id });

export const useChainSystems = (id: string) =>
  useQuery({ queryKey: chainKeys.part(id, "systems"), queryFn: () => api.get<ChainSystems>(`/chains/${id}/systems`) });

export const useChainDeviceCredentials = (id: string) =>
  useQuery({ queryKey: chainKeys.part(id, "device-credentials"), queryFn: () => api.get<ChainDeviceCredentials>(`/chains/${id}/device-credentials`) });

export const useChainTheatres = (id: string) =>
  useQuery({ queryKey: chainKeys.part(id, "theatres"), queryFn: () => api.get<ChainTheatre[]>(`/chains/${id}/theatres`) });

export const useChainLogs = (id: string) =>
  useQuery({ queryKey: chainKeys.part(id, "logs"), queryFn: () => api.get<ChainLogEntry[]>(`/chains/${id}/logs`) });

/** Dialling codes for phone numbers; they change rarely. */
export const useCallingCodes = () =>
  useQuery({ queryKey: chainKeys.callingCodes, queryFn: () => api.get<CallingCode[]>("/chains/calling-codes"), staleTime: Infinity });

export const useDeleteChain = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/chains/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: chainKeys.all }),
  });
};

/** Save a chain's Basic and Contact Information. */
export const useUpdateChain = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: ChainDetailsInput & { id: string }) => api.put<ChainDetails>(`/chains/${id}`, input),
    onSuccess: (chain) => {
      qc.setQueryData(chainKeys.detail(chain.id), chain);
      qc.invalidateQueries({ queryKey: chainKeys.all });
      // Theatres show the chain's name
      qc.invalidateQueries({ queryKey: ["theatres"] });
    },
  });
};

/** Replace the TMSes a chain's theatres may use. */
export const useSetChainTms = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, deviceIds }: { id: string; deviceIds: string[] }) => api.put<Chain>(`/chains/${id}/tms`, { deviceIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chainKeys.all });
      qc.invalidateQueries({ queryKey: ["theatres", "systems"] });
    },
  });
};
