import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Secondary text, also searchable (e.g. a role's description). */
  description?: string;
  disabled?: boolean;
}

interface ComboboxProps {
  id?: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Show a clear button when a value is selected (for optional fields). */
  clearable?: boolean;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

/**
 * Searchable single-select (Qube DS ComboBox): a select-style trigger that
 * opens a filterable list. Type to narrow, arrow keys + Enter to pick.
 */
export const Combobox = ({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No matches",
  clearable = false,
  disabled = false,
  loading = false,
  className,
  ...aria
}: ComboboxProps) => {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);
  const showClear = clearable && !!selected && !disabled && !loading;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* The clear button is a sibling of the trigger, not nested in it, so each is its own control */}
      <div className={cn("relative w-full", className)}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-invalid={aria["aria-invalid"]}
            aria-label={aria["aria-label"]}
            aria-describedby={aria["aria-describedby"]}
            disabled={disabled || loading}
            className={cn(
              "flex h-[2.125rem] w-full items-center justify-between gap-1 rounded-sm border border-input bg-card px-2 py-1 text-left text-sm leading-5",
              "focus:border-primary focus:outline-none aria-[invalid=true]:border-red-500",
              "disabled:cursor-not-allowed disabled:border-grey-300 disabled:bg-grey-100 disabled:text-muted-foreground",
              showClear && "pr-12",
            )}
          >
            <span className={cn("truncate", !selected && "text-grey-300")}>
              {loading ? "Loading…" : selected ? selected.label : placeholder}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        {showClear && (
          <button
            type="button"
            aria-label={`Clear ${aria["aria-label"] ?? "selection"}`}
            className="absolute right-7 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            onClick={() => onChange(null)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[12rem] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9" />
          <CommandList className="max-h-64">
            <CommandEmpty className="py-4 text-center text-sm text-muted-foreground">{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  // cmdk matches on value + keywords; keep the id unique but search the label/description
                  value={`${o.label} ${o.value}`}
                  keywords={o.description ? [o.description] : undefined}
                  disabled={o.disabled}
                  onSelect={() => { onChange(o.value); setOpen(false); }}
                  className="gap-2"
                >
                  <Check className={cn("h-4 w-4 shrink-0", o.value === value ? "opacity-100" : "opacity-0")} />
                  {/* With a description, the label (e.g. a role code) keeps its width and the description truncates */}
                  <span className={cn(o.description ? "shrink-0" : "truncate")}>{o.label}</span>
                  {o.description && (
                    <span className="ml-auto min-w-0 truncate pl-2 text-xs text-muted-foreground" title={o.description}>
                      {o.description}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
