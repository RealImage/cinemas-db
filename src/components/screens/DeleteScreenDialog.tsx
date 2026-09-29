import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusReasonFields } from "./components/StatusReasonFields";
import { screenLabel } from "@/data/screenRules";
import { common } from "@/i18n/common";
import type { Screen } from "@/types";

/**
 * Marks a saved screen Deleted, with the reason legacy asks for. Screens are only soft-deleted: the screen
 * stays with its theatre, marked Deleted, when the theatre is saved.
 */
export function DeleteScreenDialog({ screen, onOpenChange, onDelete }: {
  screen: Screen | null;
  onOpenChange: (open: boolean) => void;
  onDelete: (patch: Pick<Screen, "status" | "statusReasonId" | "statusComments">) => void;
}) {
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [comments, setComments] = useState("");
  const [tried, setTried] = useState(false);

  const handleOpenChange = (open: boolean) => {
    if (!open) { setReasonId(null); setComments(""); setTried(false); }
    onOpenChange(open);
  };
  const confirm = () => {
    if (!reasonId) { setTried(true); return; }
    onDelete({ status: "Deleted", statusReasonId: reasonId, statusComments: comments });
    handleOpenChange(false);
  };

  return (
    <Dialog open={!!screen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete {screen ? screenLabel(screen) : "screen"}</DialogTitle>
          <DialogDescription>The screen is marked Deleted when you save the theatre. Choose why it's being deleted.</DialogDescription>
        </DialogHeader>
        <StatusReasonFields
          status="Deleted"
          reasonId={reasonId}
          comments={comments}
          onChange={(p) => { setReasonId(p.statusReasonId ?? null); setComments(p.statusComments ?? ""); }}
          error={tried && !reasonId ? "Choose a reason for deleting the screen" : undefined}
          idPrefix="delete-screen"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>{common.cancel}</Button>
          <Button variant="destructive" onClick={confirm}>{common.delete}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
