import { Theatre } from "@/types";
import { toast } from "sonner";
import { useSetTheatreStatus, useUpdateTheatre } from "@/hooks/api/theatres";

/** Theatre list actions, persisted through the API with success/error toasts. */
export const useTheatreHandlers = () => {
  const updateTheatre = useUpdateTheatre();
  const setStatus = useSetTheatreStatus();

  const handleSaveTheatre = async (theatreData: Partial<Theatre>, editingTheatre?: Theatre) => {
    const id = editingTheatre?.id ?? theatreData.id;
    if (!id) return;
    try {
      await updateTheatre.mutateAsync({ ...theatreData, id });
    } catch (err) {
      toast.error(`Could not save theatre: ${(err as Error).message}`);
      throw err;
    }
  };

  const handleToggleStatus = async (theatre: Theatre) => {
    const newStatus = theatre.status === "Active" ? "Inactive" : "Active";
    try {
      await setStatus.mutateAsync({ id: theatre.id, status: newStatus });
      toast.success(`Theatre "${theatre.name}" ${newStatus === "Active" ? "activated" : "deactivated"} successfully`);
    } catch (err) {
      toast.error(`Could not update theatre status: ${(err as Error).message}`);
    }
  };

  return { handleSaveTheatre, handleToggleStatus };
};
