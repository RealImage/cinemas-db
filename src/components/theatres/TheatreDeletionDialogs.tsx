import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ReasonFields } from "@/components/screens/components/StatusReasonFields";
import { useDeleteTheatre, useRequestTheatreDeletion } from "@/hooks/api/theatres";
import { permanentDeleteAllowed, useNow } from "./theatreDeletion";
import { formatDateTime } from "@/lib/dateUtils";
import { common } from "@/i18n/common";
import { THEATRE_DELETION_REASON_TYPE, THEATRE_PERMANENT_DELETE_HOURS, type Theatre } from "@/types";

/**
 * Request a theatre's deletion, with a reason. Nothing is deleted yet: an approver approves the request, which
 * soft-deletes the theatre; it can be restored until it's deleted permanently, 48 hours later.
 */
export function RequestTheatreDeletionDialog({ theatre, onOpenChange }: {
  theatre: Pick<Theatre, "id" | "name"> | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [comments, setComments] = useState("");
  const [tried, setTried] = useState(false);
  const request = useRequestTheatreDeletion();

  const handleOpenChange = (open: boolean) => {
    if (!open) { setReasonId(null); setComments(""); setTried(false); }
    onOpenChange(open);
  };
  const confirm = async () => {
    if (!theatre) return;
    if (!reasonId) { setTried(true); return; }
    try {
      await request.mutateAsync({ id: theatre.id, reasonId, comments });
      toast.success(`Deletion of "${theatre.name}" requested. It's waiting for approval.`);
      handleOpenChange(false);
    } catch (err) {
      toast.error(`Could not request deletion: ${(err as Error).message}`);
    }
  };

  return (
    <Dialog open={!!theatre} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request deletion of {theatre?.name}</DialogTitle>
          <DialogDescription>
            The theatre isn't deleted yet. An approver reviews the request in Approvals &amp; Conflicts. Once approved,
            the theatre is marked Deleted and can still be restored; it can be deleted permanently, with its screens and
            change history, {THEATRE_PERMANENT_DELETE_HOURS} hours later.
          </DialogDescription>
        </DialogHeader>
        <ReasonFields
          reasonType={THEATRE_DELETION_REASON_TYPE}
          label="Reason for deleting"
          reasonId={reasonId}
          comments={comments}
          onChange={(p) => { setReasonId(p.reasonId); setComments(p.comments); }}
          error={tried && !reasonId ? "Choose a reason for deleting the theatre" : undefined}
          idPrefix="delete-theatre"
          stacked
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>{common.cancel}</Button>
          <Button variant="destructive" onClick={confirm} loading={request.isPending}>{common.confirm}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type PermanentDeleteTarget = { id: string; name: string; permanentDeleteFrom?: string | null };

/** Confirm a permanent delete; the button stays disabled until the theatre may be deleted permanently. */
export function PermanentDeleteTheatreDialog({ theatre, onOpenChange }: {
  theatre: PermanentDeleteTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const now = useNow();
  const remove = useDeleteTheatre();
  const allowed = permanentDeleteAllowed(theatre?.permanentDeleteFrom, now);

  const confirm = async () => {
    if (!theatre) return;
    try {
      await remove.mutateAsync(theatre.id);
      toast.success(`"${theatre.name}" was deleted permanently`);
      onOpenChange(false);
    } catch (err) {
      toast.error(`Could not delete theatre: ${(err as Error).message}`);
    }
  };

  return (
    <Dialog open={!!theatre} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete {theatre?.name} permanently</DialogTitle>
          <DialogDescription>
            The theatre is removed with its screens, identifiers and change history. This can't be undone.
          </DialogDescription>
        </DialogHeader>
        {!allowed && (
          <p className="text-sm text-muted-foreground">
            {theatre?.permanentDeleteFrom
              ? `It can be deleted permanently from ${formatDateTime(theatre.permanentDeleteFrom)}, ${THEATRE_PERMANENT_DELETE_HOURS} hours after the deletion was approved.`
              : "Only a deleted theatre can be deleted permanently."}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{common.cancel}</Button>
          <Button variant="destructive" onClick={confirm} disabled={!allowed} loading={remove.isPending}>{common.delete}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
