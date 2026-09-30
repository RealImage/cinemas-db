
import { Edit, Trash2, Eye, Activity, ToggleLeft, ToggleRight, ClipboardList, Clock, Undo2 } from "lucide-react";
import { Theatre } from "@/types";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/dateUtils";
import type { TheatreDeleteAction } from "./theatreDeletion";

export type { TheatreDeleteAction };

type TheatreActionsProps = {
  theatre: Theatre;
  onViewDetails: (theatre: Theatre) => void;
  onViewLogs: (theatre: Theatre) => void;
  onViewWtf: (theatre: Theatre) => void;
  onEdit: (theatre: Theatre) => void;
  onDelete: (theatre: Theatre, action: TheatreDeleteAction) => void;
  onToggleStatus: (theatre: Theatre) => void;
};

export const getTheatreActions = ({
  theatre,
  onViewDetails,
  onViewLogs,
  onViewWtf,
  onEdit,
  onDelete,
  onToggleStatus
}: TheatreActionsProps) => {
  const viewActions = [
    {
      label: "View Details",
      icon: <Eye className="h-4 w-4" />,
      onClick: () => onViewDetails(theatre)
    },
    {
      label: "View WTF",
      icon: <ClipboardList className="h-4 w-4" />,
      onClick: () => onViewWtf(theatre)
    },
    {
      label: "View Logs",
      icon: <Activity className="h-4 w-4" />,
      onClick: () => onViewLogs(theatre)
    },
  ];

  // A deleted theatre can only be viewed, restored or (48 hours after the approval) deleted permanently
  if (theatre.status === "Deleted") {
    return [
      ...viewActions,
      { label: "Restore", icon: <Undo2 className="h-4 w-4" />, onClick: () => onDelete(theatre, "restore") },
      {
        // The menu can't disable an item: say when it becomes available (the dialog's button stays disabled until then)
        label: theatre.permanentDeleteFrom && new Date(theatre.permanentDeleteFrom).getTime() > Date.now()
          ? `Delete permanently (from ${formatDateTime(theatre.permanentDeleteFrom)})`
          : "Delete permanently",
        icon: <Trash2 className="h-4 w-4" />,
        onClick: () => onDelete(theatre, "permanent"),
      },
    ];
  }

  const baseActions = [
    ...viewActions,
    {
      label: "Edit",
      icon: <Edit className="h-4 w-4" />,
      onClick: () => onEdit(theatre)
    },
  ];

  if (theatre.status === "Active") {
    return [
      ...baseActions,
      {
        label: "Deactivate",
        icon: <ToggleLeft className="h-4 w-4" />,
        onClick: () => onToggleStatus(theatre)
      }
    ];
  } else {
    return [
      ...baseActions,
      {
        label: "Activate",
        icon: <ToggleRight className="h-4 w-4" />,
        onClick: () => onToggleStatus(theatre)
      },
      theatre.pendingDeletion
        ? { label: "Deletion pending approval", icon: <Clock className="h-4 w-4" />, onClick: () => onDelete(theatre, "request") }
        : { label: "Delete", icon: <Trash2 className="h-4 w-4" />, onClick: () => onDelete(theatre, "request") }
    ];
  }
};

export const useTheatreActions = () => {
  const handleEditTheatre = (theatre: Theatre) => {
    const editUrl = `/theatre/${theatre.id}/edit`;
    window.location.href = editUrl;
  };
  
  const handleToggleStatus = (theatre: Theatre) => {
    const newStatus = theatre.status === "Active" ? "Inactive" : "Active";
    toast.success(`Theatre "${theatre.name}" ${newStatus === "Active" ? "activated" : "deactivated"} successfully`);
    return newStatus;
  };
  
  return {
    handleEditTheatre,
    handleToggleStatus
  };
};
