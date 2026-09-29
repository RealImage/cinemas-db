
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Screen } from "@/types";
import { audioExperiences, soundMixes } from "@/data/screenExperienceData";

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
  
  const storedMixes = formData.sound?.soundMixes || [];
  // A stored mix missing from the list stays selectable so it still shows as checked.
  const mixOptions: string[] = [...soundMixes, ...storedMixes.filter((m) => !(soundMixes as readonly string[]).includes(m))];

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
          {mixOptions.map((mix) => (
            <div key={mix} className="flex items-center space-x-2">
              <Checkbox
                id={`sound-mix-${mix}`}
                checked={storedMixes.includes(mix)}
                onCheckedChange={() => handleSoundMixChange(mix)}
              />
              <Label htmlFor={`sound-mix-${mix}`} className="text-sm">
                {mix}
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
