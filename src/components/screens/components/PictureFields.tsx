import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { useScreenOptions } from "@/hooks/api/screens";
import type { Screen, ScreenOption, ScreenOptions } from "@/types";

type SingleKey = "screenTypeId" | "screenManufacturerId" | "digitalIntegratorId";
type MultiKey = "threeDModelIds" | "datasatProviderIds" | "adConsolidatorIds";

const SINGLE: { key: SingleKey; label: string; list: keyof ScreenOptions }[] = [
  { key: "screenTypeId", label: "Screen Type", list: "screenTypes" },
  { key: "screenManufacturerId", label: "Screen Manufacturer", list: "screenManufacturers" },
  { key: "digitalIntegratorId", label: "Digital Integrator", list: "digitalIntegrators" },
];
const MULTI: { key: MultiKey; label: string; list: keyof ScreenOptions }[] = [
  { key: "threeDModelIds", label: "3D Model(s)", list: "threeDModels" },
  { key: "datasatProviderIds", label: "Datasat Provider(s)", list: "datasatProviders" },
  { key: "adConsolidatorIds", label: "Advertising Consolidator(s)", list: "adConsolidators" },
];

/** Legacy's Picture choices: screen type, manufacturer, digital integrator, 3D models, Datasat and ad consolidators. */
export function PictureFields({ formData, setFormData }: {
  formData: Partial<Screen>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Screen>>>;
}) {
  const optionsQuery = useScreenOptions();
  const options = optionsQuery.data;
  const placeholder = (label: string) =>
    optionsQuery.isError ? "Could not load options" : `Select ${label.toLowerCase()}`;
  // Keep a saved choice visible even if it's no longer in the list
  const choices = (list: ScreenOption[], keep: string[]) =>
    [...list, ...keep.filter((id) => !list.some((o) => o.id === id)).map((id) => ({ id, name: id }))];

  return (
    <div className="space-y-4">
      {optionsQuery.isError && (
        <p className="text-xs text-red-500">
          Could not load the screen options: {optionsQuery.error.message}{" "}
          <button type="button" className="underline" onClick={() => optionsQuery.refetch()}>Retry</button>
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {SINGLE.map(({ key, label, list }) => {
          const value = formData[key] ?? null;
          return (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{label}</Label>
              <Combobox
                id={key}
                aria-label={label}
                value={value}
                onChange={(v) => setFormData((prev) => ({ ...prev, [key]: v }))}
                options={choices(options?.[list] ?? [], value ? [value] : []).map((o) => ({ value: o.id, label: o.name }))}
                placeholder={placeholder(label)}
                loading={!options && !optionsQuery.isError}
                disabled={optionsQuery.isError}
                clearable
              />
            </div>
          );
        })}
      </div>
      {MULTI.map(({ key, label, list }) => {
        const selected = formData[key] ?? [];
        const all = choices(options?.[list] ?? [], selected);
        const toggle = (id: string) => setFormData((prev) => {
          const current = prev[key] ?? [];
          return { ...prev, [key]: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] };
        });
        return (
          <div key={key} className="space-y-2">
            <Label>{label}</Label>
            <div className="flex flex-wrap gap-4">
              {!options && !optionsQuery.isError && <span className="text-xs text-muted-foreground">Loading…</span>}
              {options && all.length === 0 && <span className="text-xs text-muted-foreground">None in the list yet</span>}
              {all.map((o) => (
                <div key={o.id} className="flex items-center space-x-2">
                  <Checkbox id={`${key}-${o.id}`} checked={selected.includes(o.id)} onCheckedChange={() => toggle(o.id)} />
                  <Label htmlFor={`${key}-${o.id}`} className="text-sm">{o.name}</Label>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
