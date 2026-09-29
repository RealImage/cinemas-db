import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IMAX_INTEGRATION_TYPES, isImaxScreen, type ImaxIntegrationType, type Screen } from "@/types";

type BooleanFlag = "multiThumbprintKdmScreen" | "flmManagementLock" | "autoScreenUpdateLock" | "automation";

const FLAGS: { key: BooleanFlag; label: string }[] = [
  { key: "multiThumbprintKdmScreen", label: "Multi-thumbprint KDM Screen (dual projector)" },
  { key: "flmManagementLock", label: "FLM Screen-Device Management Lock" },
  { key: "autoScreenUpdateLock", label: "Auto Screen Update Lock" },
  { key: "automation", label: "Automation" },
];


/** Every screen flag, in one place on the General tab. */
export function ScreenFlags({ formData, setFormData, error }: {
  formData: Partial<Screen>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Screen>>>;
  /** Why the IMAX integration type is missing, once the user tries to save. */
  error?: string;
}) {
  const set = (patch: Partial<Screen>) => setFormData((prev) => ({ ...prev, ...patch }));
  // IMAX integration is tracked only on IMAX screens (the Projection tab clears it when the last IMAX experience goes)
  const showImax = isImaxScreen(formData.projection?.experiences);

  return (
    <fieldset className="space-y-3 rounded-md border p-4">
      <legend className="px-1 text-sm font-medium">Screen Flags</legend>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {FLAGS.map(({ key, label }) => (
          <div key={key} className="flex items-center space-x-2">
            <Checkbox id={key} checked={!!formData[key]} onCheckedChange={(v) => set({ [key]: !!v })} />
            <Label htmlFor={key}>{label}</Label>
          </div>
        ))}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="iabSupported"
            checked={!!formData.sound?.iabSupported}
            onCheckedChange={(v) => setFormData((prev) => ({ ...prev, sound: { soundMixes: [], ...prev.sound, iabSupported: !!v } }))}
          />
          <Label htmlFor="iabSupported">Immersive Audio Bitstream (IAB)</Label>
        </div>
      </div>

      {showImax && (
        <div className="grid grid-cols-1 gap-3 border-t pt-3 md:grid-cols-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="imaxIntegrated"
              checked={!!formData.imaxIntegrated}
              onCheckedChange={(v) => set({ imaxIntegrated: !!v, imaxIntegrationType: v ? formData.imaxIntegrationType ?? null : null })}
            />
            <Label htmlFor="imaxIntegrated">IMAX Screen Integrated</Label>
          </div>
          {formData.imaxIntegrated && (
            <div className="space-y-1">
              <Label htmlFor="imaxIntegrationType">Integration Type</Label>
              <Select
                value={formData.imaxIntegrationType ?? ""}
                onValueChange={(v) => set({ imaxIntegrationType: v as ImaxIntegrationType })}
              >
                <SelectTrigger id="imaxIntegrationType" aria-invalid={!!error} aria-describedby={error ? "imaxIntegrationType-error" : undefined}>
                  <SelectValue placeholder="Select integration type" />
                </SelectTrigger>
                <SelectContent>
                  {IMAX_INTEGRATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              {error && <p id="imaxIntegrationType-error" className="text-xs text-red-500">{error}</p>}
            </div>
          )}
        </div>
      )}
    </fieldset>
  );
}
