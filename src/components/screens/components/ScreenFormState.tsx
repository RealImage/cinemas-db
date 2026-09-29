
import { useState } from "react";
import { Screen } from "@/types";
import { toast } from "sonner";
import { normalizeScreenNumber, screenIdentityErrors, screenLabel } from "@/data/screenRules";

interface UseScreenFormProps {
  initialData?: Screen;
  theatreId: string;
  /** The theatre's other screens, which this one's number and name must not repeat. */
  otherScreens?: Screen[];
  onSave: (screen: Partial<Screen>) => void;
  onOpenChange: (open: boolean) => void;
}

export const useScreenForm = ({ 
  initialData,
  theatreId,
  otherScreens = [],
  onSave,
  onOpenChange
}: UseScreenFormProps) => {
  const isEditing = !!initialData;
  
  const [formData, setFormData] = useState<Partial<Screen>>(
    initialData || {
      id: crypto.randomUUID(),
      theatreId,
      number: "",
      name: "",
      uuid: crypto.randomUUID(),
      thirdPartyId: "",
      operators: [{ name: "", email: "", phone: "" }],
      autoScreenUpdateLock: false,
      flmManagementLock: false,
      multiThumbprintKdmScreen: false,
      automation: false,
      imaxIntegrated: false,
      imaxIntegrationType: null,
      status: "Active",
      closureNotes: "",
      seatingCapacity: undefined,
      coolingType: "",
      wheelchairAccessibility: false,
      motionSeats: false,
      dimensions: {
        auditoriumWidth: undefined,
        auditoriumHeight: undefined,
        auditoriumDepth: undefined,
        screenWidth: undefined,
        screenHeight: undefined,
        throwDistance: undefined,
        gain: undefined
      },
      projection: {
        type: "",
        manufacturer: "",
        masking: false
      },
      sound: {
        processor: "",
        speakers: "",
        soundMixes: [],
        iabSupported: false
      },
      devices: [],
      ipAddresses: [],
      suites: [],
      temporaryClosures: [],
      createdAt: "",
      updatedAt: "",
      createdBy: "",
      updatedBy: ""
    }
  );
  
  const [thirdPartyDomain, setThirdPartyDomain] = useState<string>(
    initialData?.thirdPartyId ? initialData.thirdPartyId.split(':')[0] : ""
  );
  
  const [thirdPartyValue, setThirdPartyValue] = useState<string>(
    initialData?.thirdPartyId ? initialData.thirdPartyId.split(':')[1] || "" : ""
  );
  
  const [submitted, setSubmitted] = useState(false);
  const identityErrors = {
    ...screenIdentityErrors(formData as Screen, otherScreens),
    imaxIntegrationType: formData.imaxIntegrated && !formData.imaxIntegrationType ? "Choose how the IMAX screen is integrated" : undefined,
    statusReason: formData.status !== "Active" && !formData.statusReasonId
      ? `Choose a reason for ${formData.status === "Inactive" ? "deactivating" : "deleting"} the screen` : undefined,
  };
  // "Enter a number or a name" waits for a save attempt; format and duplicate problems show as you type
  const errors = submitted ? identityErrors : { number: identityErrors.number, name: formData.name?.trim() ? identityErrors.name : undefined };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const problem = identityErrors.number ?? identityErrors.name ?? identityErrors.imaxIntegrationType ?? identityErrors.statusReason;
    if (problem) {
      setSubmitted(true);
      toast.error(problem);
      return;
    }
    
    const updatedFormData = {
      ...formData,
      number: normalizeScreenNumber(formData.number) ?? "",
      name: formData.name?.trim() ?? "",
      thirdPartyId: thirdPartyDomain && thirdPartyValue 
        ? `${thirdPartyDomain}:${thirdPartyValue}` 
        : undefined
    };
    
    onSave(updatedFormData);
    onOpenChange(false);
    
    toast.success(
      isEditing 
        ? `${screenLabel(updatedFormData)} updated` 
        : `${screenLabel(updatedFormData)} added`
    );
  };

  return {
    formData,
    setFormData,
    thirdPartyDomain,
    setThirdPartyDomain,
    thirdPartyValue,
    setThirdPartyValue,
    isEditing,
    errors,
    handleSubmit
  };
};
