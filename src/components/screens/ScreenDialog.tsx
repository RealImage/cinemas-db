
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Screen } from "@/types";
import { ScreenForm } from "./components/ScreenForm";
import { useScreenForm } from "./components/ScreenFormState";

interface ScreenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theatreId: string;
  screen?: Screen;
  /** The theatre's other screens, which this one's number and name must not repeat. */
  otherScreens?: Screen[];
  onSave: (screen: Partial<Screen>) => void;
}

export const ScreenDialog = ({
  open,
  onOpenChange,
  theatreId,
  screen,
  otherScreens,
  onSave,
}: ScreenDialogProps) => {
  const {
    formData,
    setFormData,
    thirdPartyDomain,
    setThirdPartyDomain,
    thirdPartyValue,
    setThirdPartyValue,
    isEditing,
    errors,
    handleSubmit
  } = useScreenForm({
    initialData: screen,
    theatreId,
    otherScreens,
    onSave,
    onOpenChange
  });
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden h-[80vh] w-full p-0">
        <div className="flex flex-col h-full">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>{isEditing ? "Edit Screen" : "Create New Screen"}</DialogTitle>
            <DialogDescription>
              {isEditing 
                ? "Update the details of an existing screen" 
                : "Enter the details to create a new screen"}
            </DialogDescription>
          </DialogHeader>
          
          <ScreenForm
            formData={formData}
            setFormData={setFormData}
            thirdPartyDomain={thirdPartyDomain}
            setThirdPartyDomain={setThirdPartyDomain}
            thirdPartyValue={thirdPartyValue}
            setThirdPartyValue={setThirdPartyValue}
            onSubmit={handleSubmit}
            isEditing={isEditing}
            errors={errors}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
