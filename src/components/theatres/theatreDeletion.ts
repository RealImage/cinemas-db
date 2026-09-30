import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRestoreTheatre } from "@/hooks/api/theatres";

/** The current time, updated every minute (for "can be deleted permanently from …"). */
export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** Whether a soft-deleted theatre may be deleted permanently yet. */
export const permanentDeleteAllowed = (permanentDeleteFrom: string | null | undefined, now: number) =>
  !!permanentDeleteFrom && new Date(permanentDeleteFrom).getTime() <= now;

/** Restore a soft-deleted theatre, with toasts. */
export function useRestoreTheatreAction() {
  const restore = useRestoreTheatre();
  return async (theatre: { id: string; name: string }) => {
    try {
      await restore.mutateAsync(theatre.id);
      toast.success(`"${theatre.name}" was restored`);
    } catch (err) {
      toast.error(`Could not restore theatre: ${(err as Error).message}`);
    }
  };
}

export type TheatreDeleteAction = "request" | "restore" | "permanent";
