import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { IPAddress, Screen, ScreenDevice, StatusReason, Suite } from "@/types";
import { theatreKeys } from "./theatres";

/** Device fields the IP & Suites tab edits beyond the core `ScreenDevice` type. */
export type ScreenDeviceConfig = Omit<ScreenDevice, "certificateStatus"> & {
  certificateStatus: ScreenDevice["certificateStatus"] | "Unknown";
  certificateAutoSync?: boolean;
  ipAddress?: string | null;
  subnetMask?: string | null;
  gateway?: string | null;
};
export type SuiteConfig = Suite & { effectiveFrom?: string | null; createdAt?: string };

export type ScreenDeviceConfigUpdate = {
  id: string;
  devices: ScreenDeviceConfig[];
  ipAddresses: IPAddress[];
  suites: SuiteConfig[];
};

/** Reasons for deactivating and deleting a screen. */
export const useScreenStatusReasons = (enabled = true) =>
  useQuery({
    queryKey: ["screens", "status-reasons"],
    queryFn: () => api.get<StatusReason[]>("/screens/status-reasons"),
    enabled,
    staleTime: 5 * 60_000,
  });

/** Save devices / IP addresses / suites of several screens at once (Screen Device List page). */
export const useSaveScreenDeviceConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (screens: ScreenDeviceConfigUpdate[]) => api.put<Screen[]>("/screens/device-config", { screens }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: theatreKeys.all });
      qc.invalidateQueries({ queryKey: ["approvals"] });
    },
  });
};
