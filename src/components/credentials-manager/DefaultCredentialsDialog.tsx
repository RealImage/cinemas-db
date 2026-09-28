import type { UseQueryResult } from "@tanstack/react-query";
import { KeyRound, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CredentialDevice,
  CredentialFieldDef,
  GLOBAL_REF,
  ScopedCredential,
  describeCredentialFields,
} from "@/data/credentialsManagerData";
import { QueryState } from "@/components/ui/query-state";
import { CredentialValues } from "./CredentialValues";
import { common } from "@/i18n/common";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  device: CredentialDevice | null;
  /** All credentials for this device. */
  credentialsQuery: UseQueryResult<ScopedCredential[]>;
  onManage: (device: CredentialDevice) => void;
}

const GlobalCredentials = ({ credentials, fields }: { credentials: ScopedCredential[]; fields: readonly CredentialFieldDef[] }) => {
  const global = credentials
    .filter((c) => c.scope === "global")
    .sort((a, b) => (a.ref === GLOBAL_REF ? -1 : b.ref === GLOBAL_REF ? 1 : a.ref.localeCompare(b.ref)));
  const overrides = credentials.length - global.length;
  return (
    <>
      {global.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-6 text-center">No default credentials recorded for this device.</p>
      ) : (
        global.map((c) => (
          <div key={c.id} className="rounded-lg border p-3 space-y-3">
            <p className="text-sm font-semibold">{c.ref}</p>
            <CredentialValues credential={c} fields={fields} />
          </div>
        ))
      )}
      {overrides > 0 && (
        <p className="text-xs text-muted-foreground">
          {overrides} chain, theatre or device-specific credential set{overrides === 1 ? "" : "s"} also recorded.
        </p>
      )}
    </>
  );
};

/** Read-only view of a device's Global-tab credentials (defaults + country variants). */
export const DefaultCredentialsDialog = ({ open, onOpenChange, device, credentialsQuery, onManage }: Props) => {
  if (!device) return null;
  const fields = device.credentialFields;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Default credentials — {device.brand} {device.model}
          </DialogTitle>
          <DialogDescription>{describeCredentialFields(device.credentialFields)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
          <QueryState query={credentialsQuery} label="credentials">
            {(credentials) => <GlobalCredentials credentials={credentials} fields={fields} />}
          </QueryState>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{common.close}</Button>
          <Button onClick={() => onManage(device)}>
            <Settings2 className="h-4 w-4 mr-2" /> Manage credentials
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
