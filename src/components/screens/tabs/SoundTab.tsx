
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Screen } from "@/types";
import { soundMixOptions } from "../constants";
import { audioExperiences } from "@/data/screenExperienceData";

interface SoundTabProps {
  formData: Partial<Screen>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<Screen>>>;
}

export const SoundTab = ({
  formData,
  setFormData,
}: SoundTabProps) => {
  const handleSoundChange = (field: string, value: string | boolean | string[] | undefined) => {
    setFormData((prev) => ({
      ...prev,
      sound: {
        ...(prev.sound || {}),
        [field]: value,
        soundMixes: prev.sound?.soundMixes || []
      }
    }));
  };
  
  const handleSoundMixChange = (mix: string) => {
    setFormData((prev) => {
      const currentMixes = prev.sound?.soundMixes || [];
      const updatedMixes = currentMixes.includes(mix)
        ? currentMixes.filter(m => m !== mix)
        : [...currentMixes, mix];
      
      return {
        ...prev,
        sound: {
          ...(prev.sound || {}),
          soundMixes: updatedMixes,
          processor: prev.sound?.processor || "",
          speakers: prev.sound?.speakers || "",
          iabSupported: prev.sound?.iabSupported || false
        }
      };
    });
  };
  
  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="soundProcessor">Sound Processor</Label>
          <Input
            id="soundProcessor"
            name="processor"
            value={formData.sound?.processor || ""}
            onChange={(e) => handleSoundChange("processor", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="soundSpeakers">Speakers</Label>
          <Input
            id="soundSpeakers"
            name="speakers"
            value={formData.sound?.speakers || ""}
            onChange={(e) => handleSoundChange("speakers", e.target.value)}
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label>Sound Mixes</Label>
        <div className="flex flex-wrap gap-2">
          {soundMixOptions.map((mix) => (
            <div key={mix.id} className="flex items-center space-x-2">
              <Checkbox
                id={`sound-mix-${mix.id}`}
                checked={(formData.sound?.soundMixes || []).includes(mix.id)}
                onCheckedChange={(checked) => handleSoundMixChange(mix.id)}
              />
              <Label htmlFor={`sound-mix-${mix.id}`} className="text-sm">
                {mix.label}
              </Label>
            </div>
          ))}
        </div>
      </div>
      
      <div className="space-y-2">
        <Label>Audio Experience</Label>
        <div className="flex flex-wrap gap-4">
          {audioExperiences.map((x) => {
            const current = formData.sound?.audioExperiences || [];
            return (
              <div key={x} className="flex items-center space-x-2">
                <Checkbox
                  id={`audio-experience-${x}`}
                  checked={current.includes(x)}
                  onCheckedChange={() => handleSoundChange("audioExperiences", current.includes(x) ? current.filter((e) => e !== x) : [...current, x])}
                />
                <Label htmlFor={`audio-experience-${x}`} className="text-sm">{x}</Label>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
