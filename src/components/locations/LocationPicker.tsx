import { useEffect, useState } from "react";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useLocationList } from "@/hooks/api/locations";
import {
  cityLabel,
  timezoneLabel,
  type LocationEntity,
  type LocationListParams,
  type LocationRecordMap,
} from "@/data/locationsData";

/** A picked record: its id and what to show for it. */
export interface PickedLocation {
  id: string;
  label: string;
}

type AnyRecord = LocationRecordMap[LocationEntity];

export function locationLabel(entity: LocationEntity, r: AnyRecord): string {
  switch (entity) {
    case "countries": { const c = r as LocationRecordMap["countries"]; return `${c.name} (${c.iso2})`; }
    case "provinces": { const p = r as LocationRecordMap["provinces"]; return `${p.name}, ${p.countryCode}`; }
    case "cities": return cityLabel(r as LocationRecordMap["cities"]);
    case "timezones": return timezoneLabel(r as LocationRecordMap["timezones"]);
    default: return (r as { name: string }).name;
  }
}

const useDebounced = (value: string, ms = 250) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
};

/** The server-searched option list both pickers open. */
function SearchList({
  entity,
  filter,
  selectedIds,
  onPick,
  disabledIds = [],
  searchPlaceholder,
}: {
  entity: LocationEntity;
  filter?: Partial<LocationListParams>;
  selectedIds: string[];
  onPick: (picked: PickedLocation, record: AnyRecord) => void;
  disabledIds?: string[];
  searchPlaceholder: string;
}) {
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const list = useLocationList(entity, { search: debounced, pageSize: 25, sort: "name", direction: "asc", ...filter });
  const rows = (list.data?.rows ?? []) as AnyRecord[];
  return (
    <Command shouldFilter={false}>
      <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} className="h-9" />
      <CommandList className="max-h-64">
        {list.isFetching && !rows.length ? (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Searching
          </div>
        ) : (
          <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">No matches</CommandEmpty>
        )}
        <CommandGroup>
          {rows.map((r) => {
            const inactive = entity === "timezones" && !(r as LocationRecordMap["timezones"]).isActive;
            const selected = selectedIds.includes(r.id);
            return (
              <CommandItem
                key={r.id}
                value={r.id}
                disabled={(inactive && !selected) || disabledIds.includes(r.id)}
                onSelect={() => onPick({ id: r.id, label: locationLabel(entity, r) }, r)}
                className="gap-2"
              >
                <Check className={cn("h-4 w-4 shrink-0", selected ? "opacity-100" : "opacity-0")} />
                <span className="truncate">{locationLabel(entity, r)}</span>
                {inactive && <span className="ml-auto text-xs text-muted-foreground">Inactive</span>}
              </CommandItem>
            );
          })}
        </CommandGroup>
        {list.data && list.data.total > rows.length && (
          <p className="px-3 py-2 text-xs text-muted-foreground">Showing {rows.length} of {list.data.total}; type to narrow</p>
        )}
      </CommandList>
    </Command>
  );
}

const triggerClass = cn(
  "flex min-h-[2.125rem] w-full items-center justify-between gap-1 rounded-sm border border-input bg-card px-2 py-1 text-left text-sm leading-5",
  "focus:border-primary focus:outline-none aria-[invalid=true]:border-red-500",
  "disabled:cursor-not-allowed disabled:border-grey-300 disabled:bg-grey-100 disabled:text-muted-foreground",
);

/** Searchable single select over a location list (searched on the server, so it scales to every city). */
export function LocationPicker({
  id,
  entity,
  value,
  onChange,
  filter,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  clearable = false,
  disabled = false,
  invalid = false,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
}: {
  id?: string;
  entity: LocationEntity;
  value: PickedLocation | null;
  onChange: (value: PickedLocation | null, record?: AnyRecord) => void;
  filter?: Partial<LocationListParams>;
  placeholder?: string;
  searchPlaceholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative w-full">
        <PopoverTrigger asChild>
          <button id={id} type="button" role="combobox" aria-expanded={open} aria-invalid={invalid} aria-label={ariaLabel}
            aria-describedby={describedBy} disabled={disabled} className={cn(triggerClass, clearable && value && "pr-12")}>
            <span className={cn("truncate", !value && "text-grey-300")}>{value?.label ?? placeholder}</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        {clearable && value && !disabled && (
          <button type="button" aria-label={`Clear ${ariaLabel ?? "selection"}`} onClick={() => onChange(null)}
            className="absolute right-7 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:bg-black/10">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0" align="start">
        {open && (
          <SearchList entity={entity} filter={filter} selectedIds={value ? [value.id] : []} searchPlaceholder={searchPlaceholder}
            onPick={(picked, record) => { onChange(picked, record); setOpen(false); }} />
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Searchable multi select: picked records show as removable chips. */
export function LocationMultiPicker({
  id,
  entity,
  value,
  onChange,
  placeholder = "Search…",
  invalid = false,
  "aria-label": ariaLabel,
}: {
  id?: string;
  entity: LocationEntity;
  value: PickedLocation[];
  onChange: (value: PickedLocation[]) => void;
  placeholder?: string;
  invalid?: boolean;
  "aria-label"?: string;
}) {
  const [open, setOpen] = useState(false);
  const ids = value.map((v) => v.id);
  const toggle = (picked: PickedLocation) =>
    onChange(ids.includes(picked.id) ? value.filter((v) => v.id !== picked.id) : [...value, picked]);
  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button id={id} type="button" role="combobox" aria-expanded={open} aria-invalid={invalid} aria-label={ariaLabel} className={triggerClass}>
            <span className="truncate text-grey-300">{placeholder}</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0" align="start">
          {open && <SearchList entity={entity} selectedIds={ids} searchPlaceholder={placeholder} onPick={toggle} />}
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((v) => (
            <Badge key={v.id} variant="secondary" className="gap-1 pr-1 font-normal">
              {v.label}
              <button type="button" aria-label={`Remove ${v.label}`} onClick={() => toggle(v)} className="rounded-sm hover:bg-black/10">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
