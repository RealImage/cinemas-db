
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Screen, isImaxScreen } from "@/types";
import { PictureFields } from "../components/PictureFields";
import { projectionExperiences, projectionTypes } from "@/data/screenExperienceData";

interface ProjectionTabProps {
  formData: Partial<Screen>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Screen>>>;
}

export const ProjectionTab = ({
  formData,
  setFormData,
}: ProjectionTabProps) => {
  const handleProjectionChange = (field: string, value: string | boolean | string[] | undefined) => {
    setFormData((prev) => ({
      ...prev,
      projection: {
        ...(prev.projection || {}),
        [field]: value
      }
    }));
  };
  
  const experiences = formData.projection?.experiences || [];
  // Removing the last IMAX experience also drops the IMAX integration, which only IMAX screens track
  const toggleExperience = (x: string) => {
    const next = experiences.includes(x) ? experiences.filter((e) => e !== x) : [...experiences, x];
    setFormData((prev) => ({
      ...prev,
      projection: { ...(prev.projection || {}), experiences: next },
      ...(!isImaxScreen(next) && { imaxIntegrated: false, imaxIntegrationType: null }),
    }));
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="projectionFormat">Projection Type</Label>
          <Select value={formData.projection?.projectionType || ""} onValueChange={(v) => handleProjectionChange("projectionType", v)}>
            <SelectTrigger id="projectionFormat"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              {projectionTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="projectionType">Projector Technology</Label>
          <Input
            id="projectionType"
            name="type"
            placeholder="e.g. Laser, Xenon"
            value={formData.projection?.type || ""}
            onChange={(e) => handleProjectionChange("type", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="projectionManufacturer">Projection Manufacturer</Label>
          <Input
            id="projectionManufacturer"
            name="manufacturer"
            value={formData.projection?.manufacturer || ""}
            onChange={(e) => handleProjectionChange("manufacturer", e.target.value)}
          />
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <Checkbox
          id="masking"
          checked={formData.projection?.masking || false}
          onCheckedChange={(checked) => handleProjectionChange("masking", !!checked)}
        />
        <Label htmlFor="masking">Masking</Label>
      </div>

      <div className="space-y-2">
        <Label>Projection Experience</Label>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {projectionExperiences.map((x) => (
            <div key={x} className="flex items-center space-x-2">
              <Checkbox id={`projection-experience-${x}`} checked={experiences.includes(x)} onCheckedChange={() => toggleExperience(x)} />
              <Label htmlFor={`projection-experience-${x}`} className="text-sm">{x}</Label>
            </div>
          ))}
        </div>
      </div>

      <PictureFields formData={formData} setFormData={setFormData} />
    </div>
  );
};
