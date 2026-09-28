import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import type { FleetTask } from "@/pages/TaskManagement";
import { FLEET_TIMEZONES as timezones, type FleetTaskOptions } from "@/data/fleetData";
import { useFleetTaskOptions } from "@/hooks/api/fleet";
import { common } from "@/i18n/common";

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMPTY_OPTIONS: FleetTaskOptions = { wireOSVersions: [], partnerOSVersions: [], agents: [] };

export const AddTaskDialog = ({ open, onOpenChange }: AddTaskDialogProps) => {
  const optionsQuery = useFleetTaskOptions();
  const { wireOSVersions, partnerOSVersions, agents } = optionsQuery.data ?? EMPTY_OPTIONS;
  const navigate = useNavigate();
  
  // Get current date, time, and timezone
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().slice(0, 5);
  const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Map IANA timezone to abbreviated timezone
  const getAbbreviatedTimezone = () => {
    const tzMap: Record<string, string> = {
      "America/Los_Angeles": "PST",
      "America/New_York": "EST",
      "America/Chicago": "CST",
      "America/Denver": "MST",
      "Europe/London": "GMT",
      "UTC": "UTC",
      "Asia/Kolkata": "IST",
      "Australia/Sydney": "AEST",
    };
    return tzMap[currentTimezone] || "PST";
  };

  const [formData, setFormData] = useState({
    taskType: "" as FleetTask["taskType"] | "",
    triggerDate: currentDate,
    triggerTime: currentTime,
    triggerTimezone: getAbbreviatedTimezone(),
    description: "",
    targetVersion: "",
    selectedAgent: "",
    agentTargetVersion: "",
  });

  // Get versions for selected agent
  const selectedAgentData = agents.find(a => a.id === formData.selectedAgent);

  const handleTaskTypeChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      taskType: value as FleetTask["taskType"],
      targetVersion: "",
      selectedAgent: "",
      agentTargetVersion: "",
    }));
  };

  const handleAgentChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      selectedAgent: value,
      agentTargetVersion: "",
    }));
  };

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.taskType || !formData.triggerDate || !formData.triggerTime) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate version fields based on task type
    if (formData.taskType === "WireOS Update" && !formData.targetVersion) {
      toast.error("Please select a target version for WireOS");
      return;
    }
    if (formData.taskType === "Agent Update" && (!formData.selectedAgent || !formData.agentTargetVersion)) {
      toast.error("Please select an agent and target version");
      return;
    }
    if (formData.taskType === "Agent Deactivate" && !formData.selectedAgent) {
      toast.error("Please select an agent to deactivate");
      return;
    }
    if (formData.taskType === "PartnerOS Update" && !formData.targetVersion) {
      toast.error("Please select a target version for PartnerOS");
      return;
    }

    // Navigate to edit task page with form data
    navigate("/fleet-management/task/new", {
      state: {
        taskData: {
          taskType: formData.taskType,
          triggerDate: formData.triggerDate,
          triggerTime: formData.triggerTime,
          triggerTimezone: formData.triggerTimezone,
          description: formData.description,
          targetVersion: formData.targetVersion,
          selectedAgent: formData.selectedAgent,
          agentTargetVersion: formData.agentTargetVersion,
          agentName: selectedAgentData?.name,
        }
      }
    });
    
    onOpenChange(false);
    setFormData({
      taskType: "",
      triggerDate: currentDate,
      triggerTime: currentTime,
      triggerTimezone: getAbbreviatedTimezone(),
      description: "",
      targetVersion: "",
      selectedAgent: "",
      agentTargetVersion: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Task</DialogTitle>
          <DialogDescription>
            Create a new fleet management task for your appliances.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleContinue} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="taskType">Task Type</Label>
            <Select
              value={formData.taskType}
              onValueChange={handleTaskTypeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select task type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WireOS Update">WireOS Update</SelectItem>
                <SelectItem value="Agent Update">Agent Update</SelectItem>
                <SelectItem value="Agent Deactivate">Agent Deactivate</SelectItem>
                <SelectItem value="PartnerOS Update">PartnerOS Update</SelectItem>
                <SelectItem value="Others">Others</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* WireOS Update - Target Version */}
          {formData.taskType === "WireOS Update" && (
            <div className="space-y-2">
              <Label htmlFor="wireOSVersion">Target Version</Label>
              <Combobox
                id="wireOSVersion"
                value={formData.targetVersion}
                onChange={(value) => { if (value) setFormData(prev => ({ ...prev, targetVersion: value })); }}
                options={wireOSVersions.map(version => ({ value: version, label: version }))}
                placeholder={optionsQuery.isPending ? "Loading versions…" : "Select WireOS version"}
                searchPlaceholder="Search versions…"
              />
            </div>
          )}

          {/* Agent Update - Agent Selection + Target Version */}
          {formData.taskType === "Agent Update" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="agent">Agent</Label>
                <Combobox
                  id="agent"
                  value={formData.selectedAgent}
                  onChange={(value) => { if (value) handleAgentChange(value); }}
                  options={agents.map(agent => ({ value: agent.id, label: agent.name }))}
                  placeholder={optionsQuery.isPending ? "Loading agents…" : "Select agent"}
                  searchPlaceholder="Search agents…"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agentVersion">Target Version</Label>
                <Combobox
                  id="agentVersion"
                  value={formData.agentTargetVersion}
                  onChange={(value) => { if (value) setFormData(prev => ({ ...prev, agentTargetVersion: value })); }}
                  disabled={!formData.selectedAgent}
                  options={(selectedAgentData?.versions ?? []).map(version => ({ value: version, label: version }))}
                  placeholder={formData.selectedAgent ? "Select version" : "Select agent first"}
                  searchPlaceholder="Search versions…"
                />
              </div>
            </div>
          )}

          {/* Agent Deactivate - Agent Selection */}
          {formData.taskType === "Agent Deactivate" && (
            <div className="space-y-2">
              <Label htmlFor="deactivateAgent">Agent</Label>
              <Combobox
                id="deactivateAgent"
                value={formData.selectedAgent}
                onChange={(value) => { if (value) handleAgentChange(value); }}
                options={agents.map(agent => ({ value: agent.id, label: agent.name }))}
                placeholder="Select agent to deactivate"
                searchPlaceholder="Search agents…"
              />
            </div>
          )}

          {/* PartnerOS Update - Target Version */}
          {formData.taskType === "PartnerOS Update" && (
            <div className="space-y-2">
              <Label htmlFor="partnerOSVersion">Target Version</Label>
              <Combobox
                id="partnerOSVersion"
                value={formData.targetVersion}
                onChange={(value) => { if (value) setFormData(prev => ({ ...prev, targetVersion: value })); }}
                options={partnerOSVersions.map(version => ({ value: version, label: version }))}
                placeholder={optionsQuery.isPending ? "Loading versions…" : "Select PartnerOS version"}
                searchPlaceholder="Search versions…"
              />
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="triggerDate">Trigger Date</Label>
              <Input
                id="triggerDate"
                type="date"
                value={formData.triggerDate}
                onChange={(e) => setFormData(prev => ({ ...prev, triggerDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="triggerTime">Time</Label>
              <Input
                id="triggerTime"
                type="time"
                value={formData.triggerTime}
                onChange={(e) => setFormData(prev => ({ ...prev, triggerTime: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Combobox
                id="timezone"
                value={formData.triggerTimezone}
                onChange={(value) => { if (value) setFormData(prev => ({ ...prev, triggerTimezone: value })); }}
                options={timezones.map(tz => ({ value: tz, label: tz }))}
                searchPlaceholder="Search timezones…"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Enter task description..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{common.cancel}</Button>
            <Button type="submit">Continue</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
