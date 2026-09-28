import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { common } from "@/i18n/common";

interface Agent {
  id: number;
  provider: string;
  agentName: string;
  version: string;
  updatedOn: string;
}

interface EditAgentConfigDialogProps {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wireTapSerialNumber?: string;
  applianceSerialNumber?: string;
  hostname?: string;
}

const CONTENT_TYPES = [
  "FTR", "TLR", "TSR", "TST", "RTG", "ADV", 
  "SHR", "XSN", "PSA", "POL", "CLP", "PRO", 
  "STR", "EPS", "HLT", "EVT"
];

const EditAgentConfigDialog = ({
  agent,
  open,
  onOpenChange,
  wireTapSerialNumber,
  applianceSerialNumber,
  hostname,
}: EditAgentConfigDialogProps) => {
  // Content Ingest Agent specific config
  const [contentIngestConfig, setContentIngestConfig] = useState({
    enableAutoIngestToServer: false,
    serverContentTypes: [] as string[],
    enableAutoIngestToTMS: false,
    tmsContentTypes: [] as string[],
    enableAutoIngestToFTP: false,
    ftpUsername: "",
    ftpPassword: "",
    ftpContentTypes: [] as string[],
  });

  // Live Wire Agent specific config
  const [liveWireConfig, setLiveWireConfig] = useState({
    prodUsername: "",
    prodPassword: "",
  });

  const handleSave = () => {
    console.log("Saving configuration for agent:", agent?.agentName, {
      contentIngestConfig,
      liveWireConfig,
    });
    onOpenChange(false);
  };

  const toggleContentType = (
    field: 'serverContentTypes' | 'tmsContentTypes' | 'ftpContentTypes',
    type: string
  ) => {
    setContentIngestConfig(prev => ({
      ...prev,
      [field]: prev[field].includes(type)
        ? prev[field].filter(t => t !== type)
        : [...prev[field], type]
    }));
  };

  if (!agent) return null;

  const isContentIngestAgent = agent.agentName === "Content Ingest Agent";
  const isLiveWireAgent = agent.agentName === "Live Wire";

  const ContentTypeSelector = ({ 
    selected, 
    field 
  }: { 
    selected: string[]; 
    field: 'serverContentTypes' | 'tmsContentTypes' | 'ftpContentTypes' 
  }) => (
    <div className="rounded-md border p-3">
      <ScrollArea className="h-32">
        <div className="grid grid-cols-4 gap-3">
          {CONTENT_TYPES.map((type) => (
            <div key={type} className="flex items-center space-x-2">
              <Checkbox
                id={`${field}-${type}`}
                checked={selected.includes(type)}
                onCheckedChange={() => toggleContentType(field, type)}
              />
              <label
                htmlFor={`${field}-${type}`}
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {type}
              </label>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Edit Agent Configuration</DialogTitle>
          <DialogDescription>
            Configure settings for {agent.agentName} ({agent.provider})
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Hardware Serial Number</Label>
              <p className="text-sm">{wireTapSerialNumber || "—"}</p>
            </div>
            
            <div className="space-y-2">
              <Label>Appliance Serial Number</Label>
              <p className="text-sm">{applianceSerialNumber || "—"}</p>
            </div>
            
            <div className="space-y-2">
              <Label>Host Name / Node ID</Label>
              <p className="text-sm">{hostname || "—"}</p>
            </div>
          </div>

            <Separator />

            {isContentIngestAgent ? (
              <>
                {/* Auto Ingest to Server */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="enableAutoIngestToServer">Enable Content Auto Ingest to Server</Label>
                    </div>
                    <Switch
                      id="enableAutoIngestToServer"
                      checked={contentIngestConfig.enableAutoIngestToServer}
                      onCheckedChange={(checked) =>
                        setContentIngestConfig({ ...contentIngestConfig, enableAutoIngestToServer: checked })
                      }
                    />
                  </div>
                  {contentIngestConfig.enableAutoIngestToServer && (
                    <div className="space-y-2 pl-4">
                      <Label>Select content type to auto ingest</Label>
                      <ContentTypeSelector 
                        selected={contentIngestConfig.serverContentTypes} 
                        field="serverContentTypes" 
                      />
                    </div>
                  )}
                </div>

                <Separator />

                {/* Auto Ingest to TMS - API */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="enableAutoIngestToTMS">Enable Content Auto Ingest to TMS - API</Label>
                    </div>
                    <Switch
                      id="enableAutoIngestToTMS"
                      checked={contentIngestConfig.enableAutoIngestToTMS}
                      onCheckedChange={(checked) =>
                        setContentIngestConfig({ ...contentIngestConfig, enableAutoIngestToTMS: checked })
                      }
                    />
                  </div>
                  {contentIngestConfig.enableAutoIngestToTMS && (
                    <div className="space-y-2 pl-4">
                      <Label>Select content type to auto ingest</Label>
                      <ContentTypeSelector 
                        selected={contentIngestConfig.tmsContentTypes} 
                        field="tmsContentTypes" 
                      />
                    </div>
                  )}
                </div>

                <Separator />

                {/* Auto Ingest to External Storage / TMS FTP */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="enableAutoIngestToFTP">Enable Content Auto Ingest to External Storage / TMS FTP</Label>
                    </div>
                    <Switch
                      id="enableAutoIngestToFTP"
                      checked={contentIngestConfig.enableAutoIngestToFTP}
                      onCheckedChange={(checked) =>
                        setContentIngestConfig({ ...contentIngestConfig, enableAutoIngestToFTP: checked })
                      }
                    />
                  </div>
                  {contentIngestConfig.enableAutoIngestToFTP && (
                    <div className="space-y-4 pl-4">
                      <div className="space-y-2">
                        <Label htmlFor="ftpUsername">FTP Username</Label>
                        <Input
                          id="ftpUsername"
                          value={contentIngestConfig.ftpUsername}
                          onChange={(e) =>
                            setContentIngestConfig({ ...contentIngestConfig, ftpUsername: e.target.value })
                          }
                          placeholder="Enter FTP username"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ftpPassword">FTP Password</Label>
                        <Input
                          id="ftpPassword"
                          type="password"
                          value={contentIngestConfig.ftpPassword}
                          onChange={(e) =>
                            setContentIngestConfig({ ...contentIngestConfig, ftpPassword: e.target.value })
                          }
                          placeholder="Enter FTP password"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Select content type to auto ingest</Label>
                        <ContentTypeSelector 
                          selected={contentIngestConfig.ftpContentTypes} 
                          field="ftpContentTypes" 
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : isLiveWireAgent ? (
              <>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="prodUsername">PROD Username</Label>
                    <Input
                      id="prodUsername"
                      value={liveWireConfig.prodUsername}
                      onChange={(e) =>
                        setLiveWireConfig({ ...liveWireConfig, prodUsername: e.target.value })
                      }
                      placeholder="Enter PROD username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prodPassword">PROD Password</Label>
                    <Input
                      id="prodPassword"
                      type="password"
                      value={liveWireConfig.prodPassword}
                      onChange={(e) =>
                        setLiveWireConfig({ ...liveWireConfig, prodPassword: e.target.value })
                      }
                      placeholder="Enter PROD password"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Configuration options for {agent.agentName} coming soon
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{common.cancel}</Button>
          <Button onClick={handleSave}>{common.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditAgentConfigDialog;
