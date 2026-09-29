
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Screen } from "@/types";
import { domainsList } from "../constants";
import { ScreenFlags } from "../components/ScreenFlags";
import { StatusReasonFields } from "../components/StatusReasonFields";

interface GeneralTabProps {
  formData: Partial<Screen>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Screen>>>;
  thirdPartyDomain: string;
  setThirdPartyDomain: React.Dispatch<React.SetStateAction<string>>;
  thirdPartyValue: string;
  setThirdPartyValue: React.Dispatch<React.SetStateAction<string>>;
  errors: { number?: string; name?: string; imaxIntegrationType?: string; statusReason?: string };
}

export const GeneralTab = ({
  formData,
  setFormData,
  thirdPartyDomain,
  setThirdPartyDomain,
  thirdPartyValue,
  setThirdPartyValue,
  errors,
}: GeneralTabProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  return (
    <div className="mt-4 space-y-4">
      <p className="text-xs text-muted-foreground">
        Enter a screen number, a screen name, or both. Neither can repeat another screen in this theatre.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="number">Screen Number</Label>
          <Input
            id="number"
            name="number"
            inputMode="numeric"
            value={formData.number || ""}
            onChange={handleChange}
            aria-invalid={!!errors.number}
            aria-describedby={errors.number ? "number-error" : undefined}
          />
          {errors.number && <p id="number-error" className="text-xs text-red-500">{errors.number}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Screen Name</Label>
          <Input
            id="name"
            name="name"
            value={formData.name || ""}
            onChange={handleChange}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
          />
          {errors.name && <p id="name-error" className="text-xs text-red-500">{errors.name}</p>}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="uuid">UUID</Label>
          <Input
            id="uuid"
            name="uuid"
            value={formData.uuid || ""}
            onChange={handleChange}
            disabled
          />
        </div>
        <div className="space-y-2">
          <Label>Third-Party ID</Label>
          <div className="flex space-x-2">
            <Combobox
              aria-label="Third-party domain"
              value={thirdPartyDomain}
              onChange={(value) => setThirdPartyDomain(value ?? "")}
              options={domainsList.map((domain) => ({ value: domain, label: domain }))}
              placeholder="Select Domain"
            />
            <Input
              type="text"
              placeholder="Enter Value"
              value={thirdPartyValue}
              onChange={(e) => setThirdPartyValue(e.target.value)}
            />
          </div>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select
          value={formData.status || ""}
          // Each status has its own reason list, so a new status starts without one
          onValueChange={(value) => setFormData((prev) => ({
            ...prev, status: value as Screen["status"], ...(value !== prev.status && { statusReasonId: null, statusComments: "" }),
          }))}
        >
          <SelectTrigger id="status">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
            <SelectItem value="Deleted">Deleted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <StatusReasonFields
        status={formData.status}
        reasonId={formData.statusReasonId}
        comments={formData.statusComments}
        onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }))}
        error={errors.statusReason}
      />

      <ScreenFlags formData={formData} setFormData={setFormData} error={errors.imaxIntegrationType} />
    </div>
  );
};
