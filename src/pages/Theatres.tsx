
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Theatre } from "@/types";
import { TheatreDialog } from "@/components/TheatreDialog";
import { AddTheatreDialog } from "@/components/AddTheatreDialog";
import { ViewTheatreDialog } from "@/components/ViewTheatreDialog";
import { TheatreLogsDialog } from "@/components/TheatreLogsDialog";
import { TheatreTable } from "@/components/theatres/TheatreTable";
import { WtfSheet } from "@/components/theatres/WtfSheet";
import { useTheatreHandlers } from "@/components/theatres/useTheatres";
import { useTheatreDeletion } from "@/components/theatres/useTheatreDeletion";

const Theatres = () => {
  const { handleSaveTheatre, handleToggleStatus } = useTheatreHandlers();
  const deletion = useTheatreDeletion();
  
  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  
  // Selected theatre states
  const [editingTheatre, setEditingTheatre] = useState<Theatre | undefined>(undefined);
  const [viewingTheatre, setViewingTheatre] = useState<Theatre | undefined>(undefined);
  const [selectedTheatre, setSelectedTheatre] = useState<Theatre | undefined>(undefined);
  
  const handleCreateTheatre = () => {
    setEditingTheatre(undefined);
    setAddDialogOpen(true);
  };
  
  const handleViewTheatre = (theatre: Theatre) => {
    setViewingTheatre(theatre);
    setViewDialogOpen(true);
  };
  
  const [wtfTheatre, setWtfTheatre] = useState<Theatre | null>(null);

  const handleViewLogs = (theatre: Theatre) => {
    setSelectedTheatre(theatre);
    setLogsDialogOpen(true);
  };
  
  const handleToggleTheatreStatus = (theatre: Theatre) => {
    void handleToggleStatus(theatre);
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          Manage all theatres in the CinemasDB system
        </p>
        <Button onClick={handleCreateTheatre}>
          <Plus className="h-4 w-4 mr-2" /> Add Theatre
        </Button>
      </div>
      
      <TheatreTable
        onViewTheatre={handleViewTheatre}
        onViewLogs={handleViewLogs}
        onViewWtf={setWtfTheatre}
        onToggleStatus={handleToggleTheatreStatus}
        onDelete={deletion.onDelete}
      />
      
      <WtfSheet theatreId={wtfTheatre?.id ?? null} theatreName={wtfTheatre?.name} onOpenChange={(open) => { if (!open) setWtfTheatre(null); }} />

      {/* Dialogs */}
      <AddTheatreDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />
      
      <ViewTheatreDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        theatre={viewingTheatre}
      />
      
      <TheatreDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        theatre={editingTheatre}
        onSave={(data) => handleSaveTheatre(data, editingTheatre)}
      />
      
      <TheatreLogsDialog
        open={logsDialogOpen}
        onOpenChange={setLogsDialogOpen}
        theatre={selectedTheatre}
      />
      
      {deletion.dialogs}
    </motion.div>
  );
};

export default Theatres;
