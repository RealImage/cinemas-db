import { useEffect, useState } from "react";
import { Eye, Pencil, Plus, Settings2, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DataTable, Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { AgentConfiguration, AgentDetails, ConfigScope, configScopes } from "@/data/agentConfigData";
import { useDeleteAgentConfiguration, useSaveAgentConfiguration } from "@/hooks/api/agentConfigs";
import { common } from "@/i18n/common";
import { ConfigCell, ConfigValuesGrid } from "./ConfigValues";
import { EditConfigurationDialog } from "./EditConfigurationDialog";
import { TheatreNameWithInfo } from "@/components/theatres/TheatreInfo";

interface Props {
  agent: AgentDetails;
  scope: ConfigScope;
  rows: AgentConfiguration[]; // already filtered to this scope
  /** Opens the Edit agent dialog, for agents without a configurations format. */
  onEditAgent: () => void;
  /** Chain or theatre whose configuration opens for editing on arrival (added when it has none). */
  openRef?: string;
  /** Called once `openRef` has been opened, so it isn't opened again. */
  onOpenRefHandled?: () => void;
}

const scopeHints: Record<ConfigScope, string> = {
  global: "The default configuration for every theatre running this agent.",
  chain: "Overrides the global configuration for every theatre in a chain.",
  theatre: "Overrides chain and global configurations for a single theatre.",
};

const optionsFor = (key: "ref" | "updatedBy") => (rows: AgentConfiguration[]) =>
  Array.from(new Set(rows.map((r) => r[key]))).sort((a, b) => a.localeCompare(b));

export const ConfigurationsTab = ({ agent, scope, rows, onEditAgent, openRef, onOpenRefHandled }: Props) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const save = useSaveAgentConfiguration();
  const remove = useDeleteAgentConfiguration();

  const scopeInfo = configScopes.find((s) => s.id === scope)!;
  const fields = agent.configFields;
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const sorted = [...rows].sort((a, b) => a.ref.localeCompare(b.ref));
  // Global holds a single row
  const canAdd = fields.length > 0 && !(scope === "global" && rows.length > 0);

  /** Chain or theatre to preselect when a link opens Add; cleared by any other open. */
  const [addRef, setAddRef] = useState<string | undefined>(undefined);
  const openView = (r: AgentConfiguration) => { setSelectedId(r.id); setViewOpen(true); };
  const openEdit = (r: AgentConfiguration | null) => { setAddRef(undefined); setSelectedId(r?.id ?? null); setViewOpen(false); setEditOpen(true); };
  const openDelete = (r: AgentConfiguration) => { setSelectedId(r.id); setDeleteOpen(true); };

  // Arriving from a link (e.g. the theatre form's Live Wire section): open that configuration, once
  useEffect(() => {
    if (!openRef || fields.length === 0) return;
    const existing = rows.find((r) => r.ref === openRef);
    setAddRef(existing ? undefined : openRef);
    setSelectedId(existing?.id ?? null);
    setViewOpen(false);
    setEditOpen(true);
    onOpenRefHandled?.();
  }, [openRef, rows, fields.length, onOpenRefHandled]);

  if (fields.length === 0) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
        <p>This agent has no configurations. Add them to its configurations format first.</p>
        <Button variant="outline" size="sm" onClick={onEditAgent}>
          <Settings2 className="h-4 w-4 mr-2" /> Edit agent
        </Button>
      </div>
    );
  }

  const handleSave = (input: Parameters<typeof save.mutateAsync>[0]) =>
    save.mutateAsync(input).then(
      (saved) => { toast.success(`${input.configId ? "Updated" : "Added"} ${scopeInfo.label.toLowerCase()} configuration${scope === "global" ? "" : ` for ${saved.ref}`}`); },
      (err: Error) => { toast.error(`Could not save the configuration: ${err.message}`); throw err; },
    );

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault(); // keep the confirmation open until the delete finishes
    if (!selected) return;
    const target = selected;
    remove.mutate({ imageId: agent.id, configId: target.id }, {
      onSuccess: () => { toast.success(`Deleted ${scopeInfo.label.toLowerCase()} configuration${scope === "global" ? "" : ` for ${target.ref}`}`); setDeleteOpen(false); },
      onError: (err) => toast.error(`Could not delete the configuration: ${err.message}`),
    });
  };

  const columns: Column<AgentConfiguration>[] = [
    ...(scope === "global"
      ? []
      : [{
          header: scopeInfo.refLabel,
          accessor: "ref" as const,
          filterable: true,
          filterOptions: optionsFor("ref"),
          cell: (r: AgentConfiguration) => scope === "theatre" ? <TheatreNameWithInfo name={r.ref} theatreRef={r.ref} /> : <span className="font-medium">{r.ref}</span>,
        }]),
    ...fields.map((f): Column<AgentConfiguration> => ({
      header: f.name,
      // Masked values aren't sent to the browser, so they aren't searchable either
      accessor: (r) => (f.masked ? "" : r.values[f.key] ?? ""),
      cell: (r) => <ConfigCell row={r} field={f} />,
    })),
    { header: "Updated By", accessor: "updatedBy", filterable: true, filterOptions: optionsFor("updatedBy") },
    { header: "Updated At", accessor: "updatedAt", filterable: true, filterType: "dateRange", cell: (r) => <span className="whitespace-nowrap">{formatDateTime(r.updatedAt)}</span> },
  ];

  const actions = [
    { label: "View Configuration", icon: <Eye className="h-4 w-4" />, onClick: openView },
    { label: "Edit Configuration", icon: <Pencil className="h-4 w-4" />, onClick: (r: AgentConfiguration) => openEdit(r) },
    { label: "Delete Configuration", icon: <Trash2 className="h-4 w-4" />, onClick: openDelete },
  ];

  const title = (r: AgentConfiguration) => (scope === "global" ? "Global configuration" : r.ref);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{scopeHints[scope]}</p>
        <Button size="sm" onClick={() => openEdit(null)} disabled={!canAdd} title={canAdd ? undefined : "The global configuration already exists; edit it instead"}>
          <Plus className="h-4 w-4 mr-1" /> Add configuration
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          No {scopeInfo.label.toLowerCase()} configuration{scope === "global" ? "" : "s"} for this agent yet.
        </div>
      ) : (
        <DataTable
          data={sorted}
          exportName={`${scopeInfo.label} Configurations`}
          columns={columns}
          searchPlaceholder={`Search ${scopeInfo.label.toLowerCase()} configurations...`}
          actions={actions}
          onRowClick={openView}
        />
      )}

      <Dialog open={viewOpen && !!selected} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{scope === "theatre" ? <TheatreNameWithInfo name={selected.ref} theatreRef={selected.ref} nameClassName="" /> : title(selected)}</DialogTitle>
                <DialogDescription>{scopeInfo.label} configuration for {agent.agentOsName}</DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border p-3">
                <ConfigValuesGrid row={selected} fields={fields} />
              </div>
              <p className="text-xs text-muted-foreground">Updated by {selected.updatedBy} on {formatDateTime(selected.updatedAt)}</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setViewOpen(false)}>{common.close}</Button>
                <Button onClick={() => openEdit(selected)}><Pencil className="h-4 w-4 mr-2" /> Edit configuration</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <EditConfigurationDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        agent={agent}
        scope={scope}
        row={selected}
        takenRefs={rows.map((r) => r.ref)}
        initialRef={selectedId ? undefined : addRef}
        onSave={(input) => handleSave({ ...input, imageId: agent.id })}
        saving={save.isPending}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {scope === "global" ? "the global configuration" : `the configuration for ${selected?.ref}`}?</AlertDialogTitle>
            <AlertDialogDescription>
              {scope === "global"
                ? "Theatres without a chain or theatre configuration will have no configuration for this agent."
                : "Broader-scope configurations will apply instead."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={remove.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {remove.isPending && <Loader2 className="animate-spin" aria-hidden />}
              {common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
