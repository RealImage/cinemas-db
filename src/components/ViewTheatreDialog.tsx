import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Theatre } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Calendar, Film, MapPin, Building, Tag, User } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";
import { common } from "@/i18n/common";

interface ViewTheatreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theatre?: Theatre;
}

export const ViewTheatreDialog = ({
  open,
  onOpenChange,
  theatre,
}: ViewTheatreDialogProps) => {
  const navigate = useNavigate();
  
  if (!theatre) return null;
  
  const handleEdit = () => {
    const editUrl = `/theatre/${theatre.id}/edit`;
    navigate(editUrl);
    onOpenChange(false);
  };
  

  // Get screen count either from screenCount property or screens array length
  const screenCount = theatre.screenCount || (theatre.screens?.length || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{theatre.name}</DialogTitle>
          <DialogDescription>
            Theatre details and information
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold">{theatre.displayName}</h3>
              <div className="flex items-center text-sm text-muted-foreground mt-1">
                <MapPin className="h-4 w-4 mr-1" />
                <span>{theatre.address || [theatre.city, theatre.state, theatre.country].filter(Boolean).join(", ")}</span>
              </div>
            </div>
            <Badge variant={theatre.status === "Active" ? "default" : "outline"}>
              {theatre.status}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Chain</p>
              <div className="flex items-center">
                <Building className="h-4 w-4 mr-1 text-muted-foreground" />
                <span>{theatre.chainName || "Not specified"}</span>
              </div>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm font-medium">Company</p>
              <span>{theatre.companyName || "Not specified"}</span>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm font-medium">Type</p>
              <div className="flex items-center">
                <Tag className="h-4 w-4 mr-1 text-muted-foreground" />
                <span>{theatre.type || "Not specified"}</span>
              </div>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm font-medium">Screens</p>
              <div className="flex items-center">
                <Film className="h-4 w-4 mr-1 text-muted-foreground" />
                <span>{screenCount}</span>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Ad Integrators</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {(theatre.adIntegrators ?? []).length > 0 ? (
                  (theatre.adIntegrators ?? []).map((integrator, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {integrator}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-xs">None</span>
                )}
              </div>
            </div>
            
            <div className="space-y-1">
              <p className="text-sm font-medium">WireTAP Serial Numbers</p>
              <div className="flex flex-col mt-1">
                {(theatre.wireTAPDevices ?? []).length > 0 ? (
                  (theatre.wireTAPDevices ?? []).map((device) => (
                    <span key={device.id} className="text-xs font-mono">
                      {device.serialNumber}
                    </span>
                  ))
                ) : (
                  <span className="text-muted-foreground text-xs">None</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="border-t pt-4 flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              <span>Last updated: {formatDate(theatre.updatedAt)}</span>
            </div>
            <div className="flex items-center">
              <User className="h-4 w-4 mr-1" />
              <span>By: {theatre.updatedBy || "Unknown"}</span>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">{common.close}</Button>
          <Button onClick={handleEdit}>
            Edit Theatre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
