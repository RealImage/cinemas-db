import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QueryState } from "@/components/ui/query-state";
import { formatDateTime } from "@/lib/dateUtils";
import { ApiError } from "@/lib/api";
import { AgentConfiguration, AgentDetails, AgentUpdateInput, IMAGE_MANAGEMENT_PATH, configScopes } from "@/data/agentConfigData";
import { useAgent, useAgentConfigurations, useUpdateAgent } from "@/hooks/api/agentConfigs";
import { ConfigFieldsList, EntitlementsList } from "@/components/fleet/agent-configs/ConfigValues";
import { ConfigurationsTab } from "@/components/fleet/agent-configs/ConfigurationsTab";
import { EditAgentDialog } from "@/components/fleet/agent-configs/EditAgentDialog";

const Field = ({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) => (
  <div className={`space-y-1 ${className ?? ""}`}>
    <p className="text-xs text-muted-foreground">{label}</p>
    <div className="text-sm font-medium">{value || "—"}</div>
  </div>
);

const AgentNotFound = () => (
  <div className="space-y-4">
    <Button variant="ghost" asChild>
      <Link to={IMAGE_MANAGEMENT_PATH}><ArrowLeft className="h-4 w-4 mr-2" />Back</Link>
    </Button>
    <p className="text-muted-foreground">Agent not found.</p>
  </div>
);

/** Manage Agent Configurations: agent details, then its Global / Chain / Theatre configurations. */
const AgentConfigurations = () => {
  const { id } = useParams();
  const agentQuery = useAgent(id);
  const configurationsQuery = useAgentConfigurations(id);

  if (!id || (agentQuery.error instanceof ApiError && agentQuery.error.status === 404)) return <AgentNotFound />;

  return (
    <QueryState query={agentQuery} label="agent">
      {(agent) => <AgentConfigurationsView agent={agent} configurationsQuery={configurationsQuery} />}
    </QueryState>
  );
};

const AgentConfigurationsView = ({
  agent,
  configurationsQuery,
}: {
  agent: AgentDetails;
  configurationsQuery: ReturnType<typeof useAgentConfigurations>;
}) => {
  const [editOpen, setEditOpen] = useState(false);
  const updateAgent = useUpdateAgent();

  const handleSave = (patch: AgentUpdateInput) =>
    updateAgent.mutateAsync({ id: agent.id, patch }).then(
      (a) => { toast.success(`Updated ${a.agentOsName}`); },
      (err: Error) => { toast.error(`Could not update ${agent.agentOsName}: ${err.message}`); throw err; },
    );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to={IMAGE_MANAGEMENT_PATH} aria-label="Back to Image Management"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h2 className="text-lg font-semibold">{agent.agentOsName}</h2>
          <p className="text-sm text-muted-foreground">Manage agent configurations</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base">Agent Details</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" /> Edit agent
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
          <Field label="Agent Name" value={agent.agentOsName} />
          <Field label="Provider" value={agent.provider} />
          <Field label="Latest Version" value={agent.latestVersion} />
          <Field label="Updated By" value={agent.updatedBy} />
          <Field label="Agent Entitlements" className="col-span-2" value={<EntitlementsList ids={agent.entitlements} />} />
          <Field label="Configurations Format" className="col-span-2" value={<ConfigFieldsList fields={agent.configFields} />} />
          <Field label="Updated At" value={formatDateTime(agent.updatedAt)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Configurations</CardTitle>
        </CardHeader>
        <CardContent>
          <QueryState query={configurationsQuery} label="configurations">
            {(rows) => <ConfigurationTabs agent={agent} rows={rows} onEditAgent={() => setEditOpen(true)} />}
          </QueryState>
        </CardContent>
      </Card>

      <EditAgentDialog agent={agent} open={editOpen} onOpenChange={setEditOpen} onSave={handleSave} saving={updateAgent.isPending} />
    </div>
  );
};

/** Configurations by scope. `?scope=chain|theatre&ref=` opens on that tab, editing (or adding) that ref's row. */
const ConfigurationTabs = ({ agent, rows, onEditAgent }: { agent: AgentDetails; rows: AgentConfiguration[]; onEditAgent: () => void }) => {
  const [params] = useSearchParams();
  const linked = configScopes.find((s) => s.id === params.get("scope") && s.id !== "global");
  const openRef = linked ? params.get("ref") ?? undefined : undefined;
  return (
    <Tabs defaultValue={linked?.id ?? "global"}>
      <TabsList className="flex-wrap h-auto">
        {configScopes.map((s) => (
          <TabsTrigger key={s.id} value={s.id} className="gap-2">
            {s.label}
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{rows.filter((r) => r.scope === s.id).length}</Badge>
          </TabsTrigger>
        ))}
      </TabsList>
      {configScopes.map((s) => (
        <TabsContent key={s.id} value={s.id} className="mt-4">
          <ConfigurationsTab
            agent={agent}
            scope={s.id}
            rows={rows.filter((r) => r.scope === s.id)}
            onEditAgent={onEditAgent}
            openRef={s.id === linked?.id ? openRef : undefined}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
};

export default AgentConfigurations;
