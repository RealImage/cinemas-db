import { Link } from "react-router-dom";
import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheatreLiveWire } from "@/hooks/api/theatres";
import { agentConfigurationLink } from "@/data/agentConfigData";

const SOURCE_LABEL = { theatre: "This theatre", chain: "Chain", global: "Global" } as const;

/**
 * Read-only: the Live Wire settings that apply at this theatre and where each comes from. They're edited in
 * Fleet Management › Image Management › Live Wire › Manage Agent Configurations › Theatre; the link opens this
 * theatre's setting there.
 */
export function LiveWireSettings({ theatreId, theatreName }: { theatreId?: string; theatreName: string }) {
  const liveWire = useTheatreLiveWire(theatreId);

  if (!theatreId) return <p className="text-sm text-muted-foreground">Save the theatre first to set up Live Wire.</p>;
  if (liveWire.isPending) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading Live Wire settings
      </p>
    );
  }
  if (liveWire.isError) {
    return (
      <div className="flex flex-wrap items-center gap-3" role="alert">
        <p className="flex items-center gap-2 text-sm text-red-500">
          <AlertTriangle className="h-4 w-4" /> Could not load Live Wire settings: {liveWire.error.message}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => liveWire.refetch()} loading={liveWire.isFetching}>Retry</Button>
      </div>
    );
  }
  const { imageId, configuration } = liveWire.data;
  if (!imageId) return <p className="text-sm text-muted-foreground">There's no Live Wire agent in Image Management.</p>;

  const editLink = (
    <Button variant="outline" size="sm" asChild>
      <Link to={agentConfigurationLink(imageId, "theatre", theatreName)}>
        Edit this theatre's Live Wire setting <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </Button>
  );
  const set = configuration.filter((c) => c.source);

  return (
    <div className="space-y-3">
      {set.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Live Wire settings apply to this theatre yet.</p>
      ) : (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {set.map((c) => (
            <div key={c.field.key} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{c.field.name}</dt>
              <dd className="text-sm">
                {c.masked ? <span className="text-muted-foreground">Hidden</span> : c.value ? <span className="font-mono">{c.value}</span> : <span className="text-muted-foreground">Not set</span>}
                {c.source && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    from {c.source === "chain" ? `chain ${c.sourceRef}` : SOURCE_LABEL[c.source]}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {editLink}
        <span className="text-xs text-muted-foreground">Live Wire is edited in Fleet Management › Image Management › Live Wire.</span>
      </div>
    </div>
  );
}
