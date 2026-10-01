import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { TheatreSummary } from "@/data/theatreSummary";

const summaryKey = (ref: string) => ["theatres", "summary", ref] as const;

/** Name, alternate names, UID and address, each with a copy button. */
function SummaryFields({ summary }: { summary: Omit<TheatreSummary, "id"> }) {
  const fields: [label: string, value: string | null, mono?: boolean][] = [
    ["Theatre Name", summary.name],
    ["Alternate Display Names", summary.alternateNames.length ? summary.alternateNames.join(", ") : null],
    ["Theatre UID", summary.uuid, true],
    ["Theatre Address", summary.address],
  ];
  return (
    <dl className="space-y-2.5">
      {fields.map(([label, value, mono]) => (
        <div key={label} className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd className={cn("text-sm break-words", mono && "font-mono text-xs break-all", !value && "text-muted-foreground")}>
              {value ?? "—"}
            </dd>
          </div>
          {value && <CopyButton label={label} value={value} />}
        </div>
      ))}
    </dl>
  );
}

/** An icon button that copies `value` to the clipboard, with a toast ("<label> copied"). */
export function CopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
      className="mt-0.5 shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-black/5 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function FetchedSummary({ theatreRef }: { theatreRef: string }) {
  const query = useQuery({
    queryKey: summaryKey(theatreRef),
    queryFn: () => api.get<TheatreSummary>(`/theatres/${encodeURIComponent(theatreRef)}/summary`),
    staleTime: 60_000,
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });
  if (query.isPending) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading</p>;
  }
  if (query.isError) {
    return (
      <p className="text-sm text-muted-foreground">
        {query.error instanceof ApiError && query.error.status === 404 ? "This theatre isn't in CinemaDB." : `Could not load details: ${query.error.message}`}
      </p>
    );
  }
  return <SummaryFields summary={query.data} />;
}

/**
 * Info icon placed after a theatre name in lists. Hovering (or focusing) it shows the theatre's name, alternate
 * display names, UID and address, each with a copy button. Pass `theatreRef` (the theatre's id, code or UUID) to
 * load them from CinemaDB, or `details` when the row already has them (e.g. an FLM feed for a theatre not yet in
 * CinemaDB).
 */
export function TheatreInfo({
  theatreRef,
  details,
  name,
  className,
}: {
  theatreRef?: string | null;
  details?: Omit<TheatreSummary, "id">;
  /** For the icon's accessible label. */
  name: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!details && !theatreRef) return null;
  // Rows are often clickable; clicks in the icon or the card (a portal, whose events still bubble in React) stay here
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={150} closeDelay={150}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`Theatre details for ${name}`}
          onClick={(e) => { stop(e); setOpen((o) => !o); }}
          onKeyDown={stop}
          className={cn(
            "inline-flex shrink-0 items-center rounded-sm p-0.5 align-middle text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
            className,
          )}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-80" onClick={stop} onPointerDown={stop} onKeyDown={stop}>
        {open && (details ? <SummaryFields summary={details} /> : <FetchedSummary theatreRef={theatreRef!} />)}
      </HoverCardContent>
    </HoverCard>
  );
}

/** A theatre name followed by its info icon, for table cells. */
export function TheatreNameWithInfo({
  name,
  theatreRef,
  details,
  className,
  nameClassName = "font-medium",
}: {
  name: string;
  theatreRef?: string | null;
  details?: Omit<TheatreSummary, "id">;
  className?: string;
  nameClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className={nameClassName}>{name}</span>
      <TheatreInfo name={name} theatreRef={theatreRef} details={details} />
    </span>
  );
}
