
import { useState } from "react";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Theatre } from "@/types";
import { toast } from "sonner";
import { common } from "@/i18n/common";

interface DeleteTheatreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theatre?: Theatre;
  onConfirmDelete: () => void;
}

export function DeleteTheatreDialog({ 
  open, 
  onOpenChange, 
  theatre, 
  onConfirmDelete 
}: DeleteTheatreDialogProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  
  if (!theatre) return null;
  
  const handleDelete = () => {
    // In a real application, you would verify the password on the server
    // This is just a mock validation
    if (password === "password") {
      onConfirmDelete();
      setPassword("");
      setError("");
    } else {
      setError("Invalid password. Please try again.");
      toast.error("Invalid password. Please try again.");
    }
  };
  
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setPassword("");
      setError("");
    }
    onOpenChange(newOpen);
  };
  
  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Theatre</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{theatre.name}"? This action cannot be undone.
            <br />
            Please enter your password to confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="password">Your Password</Label>
            <Input 
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              className={error ? "border-red-500" : ""}
            />
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p>Note: For this demo, use "password" as the password.</p>
          </div>
        </div>
        
        <AlertDialogFooter>
          <AlertDialogCancel>{common.cancel}</AlertDialogCancel>
          <AlertDialogAction 
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            className="bg-red-500 hover:bg-red-600"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
