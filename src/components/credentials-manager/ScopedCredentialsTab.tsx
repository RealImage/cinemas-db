import { useState } from "react";
import { Eye, Pencil, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DataTable, Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
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
import { formatDateTime } from "@/lib/dateUtils";
import {
  CredentialDevice,
  CredentialScope,
  GLOBAL_REF,
  ScopedCredential,
  credentialScopes,
} from "@/data/credentialsManagerData";
import { useDeleteDeviceCredential, useSaveDeviceCredential } from "@/hooks/api/credentials";
import { CredentialCell } from "./CredentialValues";
import { ViewScopedCredentialDialog } from "./ViewScopedCredentialDialog";
import { EditScopedCredentialDialog, CredentialDraft } from "./EditScopedCredentialDialog";
import { common } from "@/i18n/common";
import { TheatreNameWithInfo } from "@/components/theatres/TheatreInfo";

interface Props {
  device: CredentialDevice;
  scope: CredentialScope;
  credentials: ScopedCredential[]; // already filtered to this device + scope
}

/** Distinct values of a field, for a column's filter options. */
const optionsFor = (key: "ref" | "updatedBy") => (rows: ScopedCredential[]) =>
  Array.from(new Set(rows.map((r) => r[key]))).sort((a, b) => a.localeCompare(b));

const scopeHints: Record<CredentialScope, string> = {
  global: "Defaults the device ships with. Add a country row where the default differs by region.",
  chain: "Overrides the global credentials for every theatre in a chain.",
  theatre: "Overrides chain and global credentials for a single theatre.",
  device: "Credentials for one specific unit, identified by serial number.",
};

export const ScopedCredentialsTab = ({ device, scope, credentials }: Props) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const scopeInfo = credentialScopes.find((s) => s.id === scope)!;
  const fields = device.credentialFields;
  const selected = credentials.find((c) => c.id === selectedId) ?? null;
  const saveCredential = useSaveDeviceCredential();
  const deleteCredential = useDeleteDeviceCredential();

  // Keep the Global row first, then alphabetical.
  const rows = [...credentials].sort((a, b) =>
    a.ref === GLOBAL_REF ? -1 : b.ref === GLOBAL_REF ? 1 : a.ref.localeCompare(b.ref),
  );

  const openView = (c: ScopedCredential) => { setSelectedId(c.id); setViewOpen(true); };
  const openEdit = (c: ScopedCredential | null) => { setSelectedId(c?.id ?? null); setViewOpen(false); setEditOpen(true); };
  const openDelete = (c: ScopedCredential) => { setSelectedId(c.id); setDeleteOpen(true); };

  const handleSave = (draft: CredentialDraft) =>
    saveCredential.mutateAsync(draft).then(
      (saved) => { toast.success(`${draft.id ? "Updated" : "Added"} credentials for ${saved.ref}`); },
      (err: Error) => {
        toast.error(`Could not save credentials for ${draft.ref}: ${err.message}`);
        throw err;
      },
    );

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault(); // keep the confirmation open until the delete finishes
    if (!selected) return;
    const target = selected;
    deleteCredential.mutate({ deviceId: target.deviceId, id: target.id }, {
      onSuccess: () => {
        toast.success(`Deleted credentials for ${target.ref}`);
        setDeleteOpen(false);
      },
      onError: (err) => toast.error(`Could not delete credentials for ${target.ref}: ${err.message}`),
    });
  };

  const columns: Column<ScopedCredential>[] = [
    {
      header: scopeInfo.refLabel,
      accessor: "ref",
      // Serial numbers are unique per row, so search covers the device tab.
      filterable: scope !== "device",
      filterOptions: optionsFor("ref"),
      cell: (row) => (
        <div>
          <p className="font-medium">
            {scope === "theatre" ? <TheatreNameWithInfo name={row.ref} theatreRef={row.ref} nameClassName="" /> : row.ref}
          </p>
          {row.location && <p className="text-xs text-muted-foreground">{row.location}</p>}
        </div>
      ),
    },
    ...fields.map((f): Column<ScopedCredential> => ({
      header: f.name,
      // Masked values aren't sent to the browser, so they aren't searchable either
      accessor: (row) => (f.masked ? "" : row.values[f.key] ?? ""),
      cell: (row) => <CredentialCell field={f} credential={row} />,
    })),
    { header: "Updated By", accessor: "updatedBy", filterable: true, filterOptions: optionsFor("updatedBy") },
    { header: "Updated At", accessor: "updatedAt", filterable: true, filterType: "dateRange", cell: (row) => <span className="whitespace-nowrap">{formatDateTime(row.updatedAt)}</span> },
  ];

  const actions = [
    { label: "View Credentials", icon: <Eye className="h-4 w-4" />, onClick: openView },
    { label: "Edit Credentials", icon: <Pencil className="h-4 w-4" />, onClick: (c: ScopedCredential) => openEdit(c) },
    { label: "Delete Credentials", icon: <Trash2 className="h-4 w-4" />, onClick: openDelete },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{scopeHints[scope]}</p>
        <Button size="sm" onClick={() => openEdit(null)}>
          <Plus className="h-4 w-4 mr-1" /> Add credentials
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          No {scopeInfo.label.toLowerCase()} for this device yet.
        </div>
      ) : (
        <DataTable
          data={rows}
          exportName={`${scopeInfo.label} Credentials`}
          columns={columns}
          searchPlaceholder={`Search ${scopeInfo.label.toLowerCase()}...`}
          actions={actions}
          onRowClick={openView}
        />
      )}

      <ViewScopedCredentialDialog open={viewOpen} onOpenChange={setViewOpen} device={device} credential={selected} onEdit={openEdit} />
      <EditScopedCredentialDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        device={device}
        scope={scope}
        credential={selected}
        takenRefs={credentials.map((c) => c.ref)}
        onSave={handleSave}
        saving={saveCredential.isPending}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete credentials for {selected?.ref}?</AlertDialogTitle>
            <AlertDialogDescription>
              {selected?.scope === "global" && selected.ref === GLOBAL_REF
                ? "These are the device's default credentials. It will show as missing default credentials until new ones are added."
                : "This removes this credential set. Broader-scope credentials will apply instead."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteCredential.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCredential.isPending && <Loader2 className="animate-spin" aria-hidden />}
              {common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
