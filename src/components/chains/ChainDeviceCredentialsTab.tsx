import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QueryState } from "@/components/ui/query-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CredentialValues } from "@/components/credentials-manager/CredentialValues";
import { credentialScopes } from "@/data/credentialsManagerData";
import { useChainDeviceCredentials } from "@/hooks/api/chains";
import type { ChainDetails, ChainDeviceModel } from "@/data/chainDetails";

const scopeLabel = (scope: string) => credentialScopes.find((s) => s.id === scope)?.label.replace(/ Credentials$/, "") ?? scope;

/** The credentials of one model that apply to the chain, as a list under its row. */
function ModelCredentials({ model }: { model: ChainDeviceModel }) {
  if (model.credentials.length === 0) {
    return <p className="text-sm text-muted-foreground">No chain, theatre or global credentials for this model.</p>;
  }
  return (
    <ul className="space-y-3">
      {model.credentials.map((c) => (
        <li key={c.id} className="rounded-md border bg-card p-3">
          <div className="mb-2 flex items-center gap-2 text-sm">
            <Badge variant="secondary" className="font-normal">{scopeLabel(c.scope)}</Badge>
            <span className="font-medium">{c.ref}</span>
          </div>
          <CredentialValues credential={c} fields={model.device.credentialFields} />
        </li>
      ))}
    </ul>
  );
}

function ModelsTable({ models }: { models: ChainDeviceModel[] }) {
  const [open, setOpen] = useState<string[]>([]);
  const toggle = (id: string) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"><span className="sr-only">Show credentials</span></TableHead>
            <TableHead>Brand</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Theatres</TableHead>
            <TableHead className="text-right">Screens</TableHead>
            <TableHead className="text-right">Credentials</TableHead>
            <TableHead className="w-10"><span className="sr-only">Open in Credentials Manager</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {models.length === 0 && (
            <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground">No device models from the Credentials Manager at this chain's theatres</TableCell></TableRow>
          )}
          {models.map((m) => {
            const expanded = open.includes(m.device.id);
            const label = `${m.device.brand} ${m.device.model}`;
            return (
              <Fragment key={m.device.id}>
                <TableRow>
                  <TableCell className="py-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggle(m.device.id)}
                      aria-expanded={expanded} aria-controls={`chain-creds-${m.device.id}`}
                      aria-label={`${expanded ? "Hide" : "Show"} credentials for ${label}`}>
                      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{m.device.brand}</TableCell>
                  <TableCell className="text-sm">{m.device.model}</TableCell>
                  <TableCell className="text-sm">{m.device.type}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{m.theatres}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{m.screens ?? "—"}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{m.credentials.length}</TableCell>
                  <TableCell className="py-1">
                    <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                      <Link to={`/theatre-device-management/credentials-manager/${m.device.id}/credentials`}
                        aria-label={`Open ${label} in the Credentials Manager`} title="Open in the Credentials Manager">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
                {expanded && (
                  <TableRow id={`chain-creds-${m.device.id}`} className="bg-muted/30 hover:bg-muted/30">
                    <TableCell />
                    <TableCell colSpan={7} className="py-3"><ModelCredentials model={m} /></TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function ChainDeviceCredentialsTab({ chain }: { chain: ChainDetails }) {
  const query = useChainDeviceCredentials(chain.id);
  return (
    <QueryState query={query} label="device credentials">
      {({ models, unmatched }) => (
        <div className="space-y-4">
          <Card className="space-y-3 p-5">
            <div>
              <h3 className="text-base font-semibold">Device models in the chain</h3>
              <p className="text-sm text-muted-foreground">
                Screen devices, TMSes and ticketing systems at {chain.name}'s theatres, with the chain, theatre and global
                credentials that apply to them. Masked values stay hidden until revealed.
              </p>
            </div>
            <ModelsTable models={models} />
          </Card>
          <Card className="space-y-3 p-5">
            <div>
              <h3 className="text-base font-semibold">Models not in the Credentials Manager</h3>
              <p className="text-sm text-muted-foreground">Screen devices whose brand and model match no device model there.</p>
            </div>
            <div className="overflow-hidden rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Manufacturer</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Theatres</TableHead>
                    <TableHead className="text-right">Screens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unmatched.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Every screen device model is in the Credentials Manager</TableCell></TableRow>
                  )}
                  {unmatched.map((m) => (
                    <TableRow key={`${m.brand}\n${m.model}`}>
                      <TableCell className="text-sm">{m.brand || "—"}</TableCell>
                      <TableCell className="text-sm">{m.model || "—"}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{m.theatres}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{m.screens}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}
    </QueryState>
  );
}
