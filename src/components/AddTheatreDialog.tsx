
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Theatre } from "@/types";
import { toast } from "sonner";
import { useCreateTheatre } from "@/hooks/api/theatres";
import { common } from "@/i18n/common";

interface AddTheatreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddTheatreDialog = ({
  open,
  onOpenChange,
}: AddTheatreDialogProps) => {
  const navigate = useNavigate();
  const createTheatre = useCreateTheatre();
  const [formData, setFormData] = useState<Partial<Theatre>>({
    name: "",
    displayName: "",
    address: "",
    status: "Active",
  });
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    // The location can be completed later; Approvals & Conflicts counts theatres still missing it
    if (!formData.name || !formData.displayName) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    try {
      // Create theatre with minimal info
      const created = await createTheatre.mutateAsync({
        name: formData.name,
        displayName: formData.displayName,
        address: formData.address,
        listing: "Listed - Public",
        type: "Multiplex",
        status: "Active",
      });
      toast.success(`Theatre "${created.name}" created successfully`);
      setFormData({ name: "", displayName: "", address: "", status: "Active" });
      onOpenChange(false);
      // Navigate to edit page to fill in the rest
      navigate(`/theatre/${created.id}/edit`);
    } catch (err) {
      toast.error(`Could not create theatre: ${(err as Error).message}`);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Theatre</DialogTitle>
          <DialogDescription>
            Enter basic theatre information to get started. You'll be able to add more details afterward.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Theatre Name *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name *</Label>
              <Input
                id="displayName"
                name="displayName"
                value={formData.displayName}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address">Theatre Address</Label>
              <Input
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="123 Main St, City, State, Country"
              />
              <p className="text-xs text-muted-foreground">Optional. You can add the location and coordinates later.</p>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {common.cancel}
            </Button>
            <Button type="submit" loading={createTheatre.isPending}>
              {common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
