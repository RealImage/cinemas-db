import { useEffect, useState } from "react";
import { format, parse } from "date-fns";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Pencil } from "lucide-react";
import { AddApplianceDialog } from "@/components/fleet/AddApplianceDialog";
import { EditTaskDialog, TaskData } from "@/components/fleet/EditTaskDialog";
import { TargetAppliancesTable } from "@/components/fleet/TargetAppliancesTable";
import { toast } from "sonner";
import { QueryState } from "@/components/ui/query-state";
import { useFleetTask, useSaveFleetTask } from "@/hooks/api/fleet";
import type { FleetTaskDetail, TaskAppliance } from "@/data/fleetData";
import { common } from "@/i18n/common";

export type { TaskAppliance } from "@/data/fleetData";

/** Normalise appliances handed over via router state (e.g. from Fleet Status). */
const fromRouterState = (initialAppliances: unknown): TaskAppliance[] => {
  if (!Array.isArray(initialAppliances)) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return initialAppliances.map((app: any, index: number) => ({
    id: app.id || `appliance-${index + 1}`,
    applianceSerialNumber: app.applianceSerial || app.applianceSerialNumber || "",
    hardwareSerialNumber: app.hardwareSerial || app.hardwareSerialNumber || "",
    nodeId: app.nodeId || app.applianceSerial || "",
    clusterName: app.cluster || app.clusterName || "",
    theatreName: app.theatreName || "",
    theatreLocation: {
      city: app.city || app.theatreLocation?.city || "",
      state: app.state || app.theatreLocation?.state || "",
      country: app.country || app.theatreLocation?.country || "",
    },
    chainName: app.chain || app.chainName || "",
    chainAddress: {
      city: app.chainAddress?.city || app.city || "",
      state: app.chainAddress?.state || app.state || "",
      country: app.chainAddress?.country || app.country || "",
    },
    updateStatus: app.updateStatus || "Pending",
    updatedOn: app.updatedOn || new Date().toISOString(),
  }));
};

/** Task detail from the API → the edit form's TaskData. */
const toTaskData = (task: FleetTaskDetail): TaskData => {
  const isAgent = task.taskType === "Agent Update" || task.taskType === "Agent Deactivate";
  return {
    taskType: task.taskType,
    triggerDate: task.triggerDay,
    triggerTime: task.triggerTime,
    triggerTimezone: task.triggerTimezone,
    description: task.description,
    targetVersion: isAgent ? "" : task.targetVersion || "",
    selectedAgent: isAgent ? task.selectedAgent || "" : "",
    agentTargetVersion: task.taskType === "Agent Update" ? task.targetVersion || "" : "",
    agentName: isAgent ? task.agentName || "" : "",
  };
};

const FleetTaskEdit = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const taskQuery = useFleetTask(id);
  const saveTask = useSaveFleetTask();

  const [taskData, setTaskData] = useState<TaskData | null>(id ? null : location.state?.taskData ?? null);
  const [appliances, setAppliances] = useState<TaskAppliance[]>(() => (id ? [] : fromRouterState(location.state?.appliances)));
  const [loadedTaskId, setLoadedTaskId] = useState<string | null>(null);

  // Editing an existing task: start from what is saved.
  useEffect(() => {
    const task = taskQuery.data;
    if (!task || loadedTaskId === task.id) return;
    setTaskData(toTaskData(task));
    setAppliances(task.appliances.map(({ clusterId: _c, attemptLogs: _l, addedOn, updatedOn, ...a }) => ({
      ...a,
      updatedOn: updatedOn ?? addedOn,
    })));
    setLoadedTaskId(task.id);
  }, [taskQuery.data, loadedTaskId]);
  const [addApplianceOpen, setAddApplianceOpen] = useState(false);
  const [editTaskOpen, setEditTaskOpen] = useState(false);

  if (id && !taskData) {
    return <QueryState query={taskQuery} label="task">{() => null}</QueryState>;
  }

  // If no task data, redirect back
  if (!taskData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/fleet-management")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <p className="text-muted-foreground">No task data found. Please start from Fleet Management.</p>
        </div>
      </div>
    );
  }


  const handleRemoveAppliance = (id: string) => {
    setAppliances(prev => prev.filter(app => app.id !== id));
    toast.success("Appliance removed from task");
  };

  const handleAddAppliance = (newAppliances: TaskAppliance[]) => {
    setAppliances(prev => {
      // Filter out duplicates
      const existingIds = new Set(prev.map(a => a.id));
      const uniqueNew = newAppliances.filter(a => !existingIds.has(a.id));
      return [...prev, ...uniqueNew];
    });
    setAddApplianceOpen(false);
    toast.success(`${newAppliances.length} appliance(s) added to task`);
  };

  const handleEditTask = (updatedTaskData: TaskData) => {
    setTaskData(updatedTaskData);
  };

  const handleSaveTask = () => {
    const isAgentUpdate = taskData.taskType === "Agent Update";
    saveTask.mutate(
      {
        id,
        taskType: taskData.taskType,
        triggerDate: taskData.triggerDate,
        triggerTime: taskData.triggerTime,
        triggerTimezone: taskData.triggerTimezone,
        description: taskData.description,
        targetVersion: (isAgentUpdate ? taskData.agentTargetVersion : taskData.targetVersion) || undefined,
        imageId: taskData.selectedAgent || undefined,
        nodeIds: appliances.map((a) => a.id),
      },
      {
        onSuccess: (saved) => {
          toast.success(id ? `Task ${saved.taskId} saved successfully` : `Task ${saved.taskId} created`);
          navigate("/fleet-management/tasks");
        },
        onError: (err) => toast.error(`Could not save task: ${err.message}`),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/fleet-management")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <p className="text-muted-foreground">Configure task details and target appliances</p>
        </div>
        <Button onClick={handleSaveTask} loading={saveTask.isPending} className="min-w-20">
          {common.save}
        </Button>
      </div>

      {/* Task Details Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Task Details</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setEditTaskOpen(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Task Type</label>
              <p className="mt-1 font-medium">{taskData.taskType}</p>
            </div>
            {taskData.agentName && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Agent</label>
                <p className="mt-1 font-medium">{taskData.agentName}</p>
              </div>
            )}
            {(taskData.targetVersion || taskData.agentTargetVersion) && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Target Version</label>
                <p className="mt-1 font-medium">{taskData.targetVersion || taskData.agentTargetVersion}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Scheduled Time</label>
              <p className="mt-1 font-medium">
                {(() => {
                  try {
                    const dateObj = parse(taskData.triggerDate, 'yyyy-MM-dd', new Date());
                    const formattedDate = format(dateObj, 'dd MMM yyyy');
                    return `${formattedDate} ${taskData.triggerTime} (${taskData.triggerTimezone})`;
                  } catch {
                    return `${taskData.triggerDate} ${taskData.triggerTime} (${taskData.triggerTimezone})`;
                  }
                })()}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <label className="text-sm font-medium text-muted-foreground">Description</label>
            <p className="mt-1 font-medium">{taskData.description}</p>
          </div>
        </CardContent>
      </Card>

      {/* Target Appliances Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>Target Appliances</CardTitle>
              <Badge variant="secondary">{appliances.length} appliances</Badge>
            </div>
            <Button onClick={() => setAddApplianceOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Appliance
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <TargetAppliancesTable
            appliances={appliances}
            onRemoveAppliance={handleRemoveAppliance}
          />
        </CardContent>
      </Card>

      <AddApplianceDialog
        open={addApplianceOpen}
        onOpenChange={setAddApplianceOpen}
        onAddAppliance={handleAddAppliance}
        existingApplianceIds={appliances.map(a => a.id)}
      />

      {taskData && (
        <EditTaskDialog
          open={editTaskOpen}
          onOpenChange={setEditTaskOpen}
          taskData={taskData}
          onSaveTask={handleEditTask}
        />
      )}
    </div>
  );
};

export default FleetTaskEdit;