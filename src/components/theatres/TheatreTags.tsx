import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  THEATRE_TAG_KINDS, sameTag, theatreTagLabel, type TheatreFacets, type TheatreTag,
} from "@/data/theatreSearch";

/** A value in a Theatre List cell that filters the list by itself when clicked. */
export function TagButton({ tag, onTag }: { tag: TheatreTag; onTag: (tag: TheatreTag) => void }) {
  return (
    <button
      type="button"
      // Rows open the theatre on click; a tag only filters
      onClick={(e) => { e.stopPropagation(); onTag(tag); }}
      onKeyDown={(e) => e.stopPropagation()}
      title={`Filter by ${theatreTagLabel(tag.kind)}: ${tag.value}`}
      className="max-w-full truncate rounded border border-transparent bg-black/[.04] px-1.5 py-0.5 text-left text-xs hover:border-primary/40 hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      {tag.value}
    </button>
  );
}

/**
 * The Theatre List's active tags as removable chips (all must match), with a picker to add chain, location and
 * linked-company tags.
 */
export function TagChips({
  tags, facets, facetsError, onRetryFacets, onAdd, onRemove, onClear,
}: {
  tags: TheatreTag[];
  facets: TheatreFacets | undefined;
  /** Why the tags couldn't be loaded, if they couldn't. */
  facetsError: string | null;
  onRetryFacets: () => void;
  onAdd: (tag: TheatreTag) => void;
  onRemove: (tag: TheatreTag) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <span key={`${tag.kind}:${tag.value}`} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 py-0.5 pl-2.5 pr-1 text-xs">
          <span className="text-muted-foreground">{theatreTagLabel(tag.kind)}:</span>
          <span className="font-medium">{tag.value}</span>
          <button
            type="button"
            onClick={() => onRemove(tag)}
            aria-label={`Remove ${theatreTagLabel(tag.kind)}: ${tag.value}`}
            className="rounded-full p-0.5 hover:bg-primary/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <Command>
            <CommandInput placeholder="Chain, city, country or company…" />
            <CommandList className="max-h-72">
              <CommandEmpty>
                {facetsError ? (
                  <span className="flex flex-col items-center gap-2">
                    <span className="text-red-500">Could not load tags: {facetsError}</span>
                    <Button variant="outline" size="sm" onClick={onRetryFacets}>Retry</Button>
                  </span>
                ) : facets ? "No matching tags" : "Loading tags…"}
              </CommandEmpty>
              {THEATRE_TAG_KINDS.map(({ value: kind, label }) => {
                const options = (facets?.tags ?? []).filter((t) => t.kind === kind && !tags.some((a) => sameTag(a, t)));
                if (!options.length) return null;
                return (
                  <CommandGroup key={kind} heading={label}>
                    {options.map((t) => (
                      <CommandItem
                        key={t.value}
                        value={`${label} ${t.value}`}
                        onSelect={() => { onAdd({ kind: t.kind, value: t.value }); setOpen(false); }}
                      >
                        <span className="flex-1 truncate">{t.value}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">{t.count}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {tags.length > 1 && (
        <Button variant="link" size="sm" className="h-7 px-1 text-xs" onClick={onClear}>Clear tags</Button>
      )}
    </div>
  );
}

/** City, province and country tags under a theatre's name (the full address on hover); clicking one filters by it. */
export const TheatreLocation = ({ row, onTag }: {
  row: { city?: string | null; state?: string | null; country?: string | null; address?: string | null };
  onTag: (tag: TheatreTag) => void;
}) => {
  const places: TheatreTag[] = [
    { kind: "city", value: row.city },
    { kind: "province", value: row.state },
    { kind: "country", value: row.country },
  ].filter((t): t is TheatreTag => !!t.value);
  if (!places.length) return <div className="text-xs text-muted-foreground">{row.address || "Location not set"}</div>;
  return (
    <div className="flex flex-wrap gap-1" title={row.address || undefined}>
      {places.map((tag) => <TagButton key={tag.kind} tag={tag} onTag={onTag} />)}
    </div>
  );
};
