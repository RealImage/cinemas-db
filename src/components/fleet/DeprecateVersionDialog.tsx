import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { common } from "@/i18n/common";

interface DeprecateVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: string;
  onConfirm: (notes: string) => void;
}

export function DeprecateVersionDialog({
  open,
  onOpenChange,
  version,
  onConfirm,
}: DeprecateVersionDialogProps) {
  const [notes, setNotes] = useState("");

  const handleConfirm = () => {
    onConfirm(notes);
    setNotes("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setNotes("");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deprecate Version</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to deprecate version {version}? This action will mark the version as deprecated.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="py-4">
          <Label htmlFor="deprecation-notes">Deprecation Notes (optional)</Label>
          <Textarea
            id="deprecation-notes"
            placeholder="Enter reason for deprecation..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-2"
            rows={3}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>{common.cancel}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            Deprecate Version
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
