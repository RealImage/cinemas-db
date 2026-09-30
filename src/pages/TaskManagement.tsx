import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { Column, SortConfig, Filter, Action } from "@/components/ui/data-table/types";
import { Plus, Eye, Edit, XCircle, ArrowRight } from "lucide-react";
import { AddTaskDialog } from "@/components/fleet/AddTaskDialog";
import { useNavigate } from "react-router-dom";
import { formatDate } from "@/lib/dateUtils";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { toast } from "sonner";
import { QueryState } from "@/components/ui/query-state";
import { useCancelFleetTask, useFleetTasks } from "@/hooks/api/fleet";
import type { FleetTask } from "@/data/fleetData";

export type { FleetTask } from "@/data/fleetData";

const getStatusColor = (status: FleetTask["status"]): string => {
  switch (status) {
    case "Completed":
      return "bg-green-500/10 text-green-500 border-green-500/20";
    case "In Progress":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "Failed":
      return "bg-red-500/10 text-red-500 border-red-500/20";
    case "Cancelled":
      return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    case "Scheduled":
      return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    default:
      return "";
  }
};

const TaskManagement = () => {
  const navigate = useNavigate();
  const tasksQuery = useFleetTasks();
  const cancelTask = useCancelFleetTask();
  const [addTaskOpen, setAddTaskOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  // Sort state
  const [sortConfig, setSortConfig] = useState<SortConfig<FleetTask>>({ key: null, direction: null });

  // Filter state
  const [filters, setFilters] = useState<Filter<FleetTask>[]>([]);

  const columns: Column<FleetTask>[] = [
    {
      accessor: "taskId",
      header: "Task ID",
      sortable: true,
    },
    {
      accessor: "taskType",
      header: "Task Type",
      sortable: true,
      filterable: true,
      filterOptions: ["WireOS Update", "Agent Update", "Agent Deactivate", "PartnerOS Update", "Others"],
    },
    {
      accessor: "triggerDate",
      header: "Trigger Date/Time",
      sortable: true,
      cell: (row) => (
        <span>
          {row.triggerDate} ({row.triggerTimezone})
        </span>
      ),
    },
    {
      accessor: "description",
      header: "Description",
      cell: (row) => (
        <span className="max-w-[300px] truncate block" title={row.description}>
          {row.description}
        </span>
      ),
    },
    {
      accessor: "affectedDevices",
      header: "Targeted Devices",
      sortable: true,
      cell: (row) => (
        <span>{row.affectedDevices ?? 0}</span>
      ),
    },
    {
      accessor: "createdBy",
      header: "Created By",
      sortable: true,
    },
    {
      accessor: "createdOn",
      header: "Created On",
      sortable: true,
      cell: (row) => formatDate(row.createdOn),
    },
    {
      accessor: "status",
      header: "Status",
      sortable: true,
      filterable: true,
      filterOptions: ["Scheduled", "In Progress", "Completed", "Cancelled", "Failed"],
      cell: (row) => (
        <Badge className={getStatusColor(row.status)} variant="outline">
          {row.status}
        </Badge>
      ),
    },
  ];

  const getActionsForTask = (task: FleetTask): Action<FleetTask>[] => {
    const actions: Action<FleetTask>[] = [
      {
        label: "View",
        icon: <Eye className="h-4 w-4" />,
        onClick: (row) => navigate(`/fleet-management/task/${row.id}/view`, { state: { task: row } }),
      },
      {
        label: "Edit",
        icon: <Edit className="h-4 w-4" />,
        onClick: (row) => navigate(`/fleet-management/task/${row.id}/edit`, { 
          state: { 
            taskData: {
              taskType: row.taskType,
              targetVersion: row.targetVersion || "",
              partnerOSVersion: row.taskType === "PartnerOS Update" ? row.targetVersion : "",
              selectedAgent: row.selectedAgent || "",
              agentName: row.agentName || "",
              agentTargetVersion: row.taskType === "Agent Update" ? row.targetVersion || "" : "",
              triggerDate: row.triggerDate.split(" ")[0],
              triggerTime: row.triggerDate.split(" ")[1] || "10:00",
              triggerTimezone: row.triggerTimezone,
              description: row.description,
            }
          } 
        }),
      },
    ];

    if (task.status === "Scheduled") {
      actions.push({
        label: "Cancel",
        icon: <XCircle className="h-4 w-4" />,
        onClick: (row) =>
          cancelTask.mutate(row.id, {
            onSuccess: () => toast.success(`Task ${row.taskId} cancelled`),
            onError: (err) => toast.error(`Could not cancel ${row.taskId}: ${err.message}`),
          }),
      });
    }

    if (task.status === "In Progress") {
      actions.push({
        label: "Track Progress",
        icon: <ArrowRight className="h-4 w-4" />,
        onClick: (row) => navigate(`/fleet-management/task/${row.id}/view`, { state: { task: row } }),
      });
    }

    return actions;
  };

  // Server-side style paging over the list fetched from the API
  const { tasks, totalCount } = useMemo(() => {
    let filteredData = [...(tasksQuery.data ?? [])];

    // Apply search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filteredData = filteredData.filter(
        (task) =>
          task.taskId.toLowerCase().includes(search) ||
          task.description.toLowerCase().includes(search) ||
          task.createdBy.toLowerCase().includes(search)
      );
    }

    // Apply filters
    filters.forEach((filter) => {
      const values = filter.value;
      if (values && (Array.isArray(values) ? values.length > 0 : values)) {
        filteredData = filteredData.filter((task) => {
          const taskValue = String(task[filter.column as keyof FleetTask]);
          if (Array.isArray(values)) {
            return values.includes(taskValue);
          }
          return taskValue === values;
        });
      }
    });

    // Apply sorting
    if (sortConfig.key && sortConfig.direction) {
      filteredData.sort((a, b) => {
        const aVal = a[sortConfig.key as keyof FleetTask];
        const bVal = b[sortConfig.key as keyof FleetTask];
        
        if (aVal === undefined || bVal === undefined) return 0;
        
        const comparison = String(aVal).localeCompare(String(bVal));
        return sortConfig.direction === "asc" ? comparison : -comparison;
      });
    }

    // Apply pagination
    const start = (currentPage - 1) * pageSize;
    return { tasks: filteredData.slice(start, start + pageSize), totalCount: filteredData.length };
  }, [tasksQuery.data, currentPage, pageSize, searchTerm, sortConfig, filters]);

  const handlePaginationChange = (page: number, size: number) => {
    setCurrentPage(page);
    setPageSize(size);
  };

  const handleSearchChange = (search: string) => {
    setSearchTerm(search);
    setCurrentPage(1);
  };

  const handleSortChange = (sortKey: keyof FleetTask | null, direction: 'asc' | 'desc' | null) => {
    setSortConfig({ key: sortKey, direction });
  };

  const handleFilterChange = (newFilters: Filter<FleetTask>[]) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          Manage and monitor fleet update tasks
        </p>
        <Button onClick={() => setAddTaskOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>

      <QueryState query={tasksQuery} label="tasks">
        {() => (
      <DataTable
        data={tasks}
        exportName="Tasks"
        columns={columns}
        searchable
        searchPlaceholder="Search by Task ID, Description, or Created By..."
        actions={getActionsForTask}
        serverSide
        totalCount={totalCount}
        pageSize={pageSize}
        onPaginationChange={handlePaginationChange}
        onSearchChange={handleSearchChange}
        onSortChange={handleSortChange}
        onFilterChange={handleFilterChange}
      />
        )}
      </QueryState>

      <AddTaskDialog
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
      />
    </div>
  );
};

export default TaskManagement;
