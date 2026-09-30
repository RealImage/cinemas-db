import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { IPAddress, Screen, ScreenDevice, ScreenOptions, StatusReason, Suite } from "@/types";
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

/** Choices for the screen form's picture fields. */
export const useScreenOptions = () =>
  useQuery({ queryKey: ["screens", "options"], queryFn: () => api.get<ScreenOptions>("/screens/options"), staleTime: 5 * 60_000 });

/** The status reason lists: deactivating / deleting a screen, deleting a theatre (filter by reasonType). */
export const useStatusReasons = (enabled = true) =>
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
