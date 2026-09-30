import { useState } from "react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/dateUtils";
import type { Theatre } from "@/types";
import { PermanentDeleteTheatreDialog, RequestTheatreDeletionDialog } from "./TheatreDeletionDialogs";
import { useRestoreTheatreAction, type TheatreDeleteAction } from "./theatreDeletion";

/**
 * The Theatre List's delete actions: request deletion (or say one is pending), restore a deleted theatre, or delete
 * it permanently. Render `dialogs` once on the page.
 */
export function useTheatreDeletion() {
  const [requesting, setRequesting] = useState<Theatre | null>(null);
  const [deleting, setDeleting] = useState<Theatre | null>(null);
  const restore = useRestoreTheatreAction();

  const onDelete = (theatre: Theatre, action: TheatreDeleteAction) => {
    if (action === "restore") void restore(theatre);
    else if (action === "permanent") setDeleting(theatre);
    else if (theatre.pendingDeletion) {
      const p = theatre.pendingDeletion;
      toast.info(`Deletion of "${theatre.name}" is waiting for approval`, {
        description: `Requested by ${p.requestedBy} on ${formatDateTime(p.requestedAt)} (${p.reason}).`,
      });
    } else setRequesting(theatre);
  };

  const dialogs = (
    <>
      <RequestTheatreDeletionDialog theatre={requesting} onOpenChange={(open) => { if (!open) setRequesting(null); }} />
      <PermanentDeleteTheatreDialog theatre={deleting} onOpenChange={(open) => { if (!open) setDeleting(null); }} />
    </>
  );
  return { onDelete, dialogs };
}
