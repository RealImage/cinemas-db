import { KeyRound, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dateUtils";
import {
  CredentialDevice,
  ScopedCredential,
  credentialScopes,
} from "@/data/credentialsManagerData";
import { CredentialValues } from "./CredentialValues";
import { common } from "@/i18n/common";
import { TheatreNameWithInfo } from "@/components/theatres/TheatreInfo";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  device: CredentialDevice;
  credential: ScopedCredential | null;
  onEdit: (credential: ScopedCredential) => void;
}

export const ViewScopedCredentialDialog = ({ open, onOpenChange, device, credential, onEdit }: Props) => {
  if (!credential) return null;
  const scope = credentialScopes.find((s) => s.id === credential.scope)!;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />{" "}
            {credential.scope === "theatre" ? <TheatreNameWithInfo name={credential.ref} theatreRef={credential.ref} nameClassName="" /> : credential.ref}
          </DialogTitle>
          <DialogDescription>
            {scope.label} for {device.brand} {device.model}
            {credential.location ? ` · ${credential.location}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border p-3 space-y-3">
          <CredentialValues credential={credential} fields={device.credentialFields} />
        </div>
        <p className="text-xs text-muted-foreground">
          Updated by {credential.updatedBy} on {formatDateTime(credential.updatedAt)}
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{common.close}</Button>
          <Button onClick={() => onEdit(credential)}>
            <Pencil className="h-4 w-4 mr-2" /> Edit credentials
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
