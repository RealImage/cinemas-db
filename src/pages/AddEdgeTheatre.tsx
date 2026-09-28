import { useState } from "react";
import { FormActions } from "@/components/ui/form-actions";
import { useParams, useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, Pencil, CalendarIcon, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { EdgeScreenDevice } from "@/data/edgeData";
import { useApplianceLookupTheatre, useEnrolApplianceTheatre, type ApplianceLookupDetail } from "@/hooks/api/appliances";
import { QueryState } from "@/components/ui/query-state";
import { cn } from "@/lib/utils";
import { common } from "@/i18n/common";

type Status = "Active" | "Device Paused" | "Inactive";

const AddEdgeTheatreForm = ({ theatre }: { theatre: ApplianceLookupDetail }) => {
  const navigate = useNavigate();
  const save = useEnrolApplianceTheatre("edge");

  const [editDetails, setEditDetails] = useState(false);
  const [editDevice, setEditDevice] = useState(false);
  const [details, setDetails] = useState({
    latitude: theatre?.latitude ?? 0,
    longitude: theatre?.longitude ?? 0,
    networkId: "",
    networkPassword: "",
  });

  const [screens, setScreens] = useState<EdgeScreenDevice[]>(() =>
    theatre.screens.map((s) => ({ ...s }))
  );
  const [activeScreenId, setActiveScreenId] = useState<string | null>(null);

  if (!theatre) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild><Link to="/qube-appliances/edge"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link></Button>
        <p className="text-muted-foreground">Theatre not found.</p>
      </div>
    );
  }

  const active = screens.find((s) => s.screenId === activeScreenId) ?? screens[0];

  const updateScreen = (id: string, patch: Partial<EdgeScreenDevice>) => {
    setScreens((prev) => prev.map((s) => (s.screenId === id ? { ...s, ...patch } : s)));
  };

  const toggleHasDevice = (id: string, checked: boolean) => {
    updateScreen(id, { hasDevice: checked, status: checked ? "Active" : "Inactive" });
  };

  const onSave = () => {
    save.mutate({ theatreId: theatre.id, ...details, screens }, {
      onSuccess: () => {
        toast.success(`${theatre.theatreName} added to Edge`);
        navigate("/qube-appliances/edge");
      },
      onError: (err) => toast.error(`Could not save ${theatre.theatreName}: ${err.message}`),
    });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/qube-appliances/edge"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h2 className="text-lg font-semibold">Add Theatre to Edge</h2>
            <p className="text-sm text-muted-foreground">{theatre.theatreName} ({theatre.theatreId})</p>
          </div>
        </div>
        <FormActions>
          <Button variant="outline" onClick={() => navigate("/qube-appliances/edge")}>{common.cancel}</Button>
          <Button onClick={onSave} loading={save.isPending}>{common.save}</Button>
        </FormActions>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Theatre Details</h3>
          <Button variant="outline" size="sm" onClick={() => setEditDetails((v) => !v)}>
            <Pencil className="h-3.5 w-3.5 mr-2" />{editDetails ? "Done" : "Edit"}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Theatre Name & ID</Label>
            <p className="text-sm font-medium">{theatre.theatreName} <span className="text-muted-foreground">({theatre.theatreId})</span></p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Theatre Location</Label>
            <p className="text-sm font-medium">{theatre.city}, {theatre.state}, {theatre.country}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Latitude</Label>
            {editDetails ? (
              <Input type="number" step="0.000001" value={details.latitude}
                onChange={(e) => setDetails((d) => ({ ...d, latitude: parseFloat(e.target.value) || 0 }))} />
            ) : <p className="text-sm font-medium">{details.latitude.toFixed(6)}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Longitude</Label>
            {editDetails ? (
              <Input type="number" step="0.000001" value={details.longitude}
                onChange={(e) => setDetails((d) => ({ ...d, longitude: parseFloat(e.target.value) || 0 }))} />
            ) : <p className="text-sm font-medium">{details.longitude.toFixed(6)}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Network ID</Label>
            {editDetails ? (
              <Input value={details.networkId} onChange={(e) => setDetails((d) => ({ ...d, networkId: e.target.value }))} placeholder="Enter Network ID" />
            ) : <p className="text-sm font-medium">{details.networkId || "—"}</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Network Password</Label>
            {editDetails ? (
              <Input type="password" value={details.networkPassword} onChange={(e) => setDetails((d) => ({ ...d, networkPassword: e.target.value }))} placeholder="Enter Password" />
            ) : <p className="text-sm font-medium">{details.networkPassword ? "••••••••" : "—"}</p>}
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr]">
          <div className="border-r bg-muted/20">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">Screens</h3>
              <p className="text-xs text-muted-foreground">{screens.filter((s) => s.hasDevice && s.status === "Active").length} of {screens.length} active</p>
            </div>
            <ScrollArea className="h-[480px]">
              <ul className="p-2 space-y-1">
                {screens.map((s) => {
                  const isActive = s.hasDevice && s.status === "Active";
                  const selected = active?.screenId === s.screenId;
                  return (
                    <li key={s.screenId}>
                      <button type="button" onClick={() => setActiveScreenId(s.screenId)}
                        className={cn(
                          "w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors border",
                          selected ? "border-primary" : "border-transparent",
                          isActive ? "bg-[hsl(142_76%_36%/0.12)] text-[hsl(142_76%_28%)] hover:bg-[hsl(142_76%_36%/0.18)]" : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                        )}>
                        <Checkbox checked={s.hasDevice}
                          onCheckedChange={(c) => toggleHasDevice(s.screenId, Boolean(c))}
                          onClick={(e) => e.stopPropagation()}
                          className={cn(isActive && "border-[hsl(142_76%_36%)] data-[state=checked]:bg-[hsl(142_76%_36%)]")} />
                        <span className="flex-1">{s.screenName}</span>
                        {isActive ? <CheckCircle2 className="h-4 w-4 text-[hsl(142_76%_36%)]" /> : <Circle className="h-4 w-4 text-muted-foreground/60" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </div>
          <div className="p-5">
            {!active ? <p className="text-sm text-muted-foreground">No screens available.</p> : (
              <div className="space-y-6">
                <section className="space-y-3">
                  <h4 className="text-sm font-semibold">Screen Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1"><Label className="text-xs text-muted-foreground">Screen Name</Label><p className="text-sm font-medium">{active.screenName}</p></div>
                    <div className="space-y-1"><Label className="text-xs text-muted-foreground">Screen ID</Label><p className="text-sm font-medium">{active.screenId}</p></div>
                  </div>
                </section>
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Edge Device</h4>
                    <div className="flex items-center gap-2">
                      {active.hasDevice && active.status === "Active" && (
                        <Badge className="bg-[hsl(142_76%_36%)] hover:bg-[hsl(142_76%_36%)]">Active</Badge>
                      )}
                      <Button variant="outline" size="sm" onClick={() => {
                        if (!editDevice && !active.hasDevice) updateScreen(active.screenId, { hasDevice: true });
                        setEditDevice((v) => !v);
                      }}>
                        <Pencil className="h-3.5 w-3.5 mr-2" />{editDevice ? "Done" : active.hasDevice ? "Edit" : "Add"}
                      </Button>
                    </div>
                  </div>
                  {!active.hasDevice && !editDevice ? (
                    <p className="text-sm text-muted-foreground italic">Edge device is not available at this screen.</p>
                  ) : editDevice ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1"><Label className="text-xs">Edge Appliance ID</Label><Input value={active.applianceId ?? ""} onChange={(e) => updateScreen(active.screenId, { applianceId: e.target.value })} placeholder="EDGE-XXXXX" /></div>
                      <div className="space-y-1"><Label className="text-xs">Device IP Address</Label><Input value={active.ipAddress ?? ""} onChange={(e) => updateScreen(active.screenId, { ipAddress: e.target.value })} placeholder="192.168.1.10" /></div>
                      <div className="space-y-1">
                        <Label className="text-xs">Installed Date</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !active.installedDate && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {active.installedDate ? format(new Date(active.installedDate), "dd MMM yyyy") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={active.installedDate ? new Date(active.installedDate) : undefined}
                              onSelect={(d) => updateScreen(active.screenId, { installedDate: d?.toISOString() })}
                              initialFocus className={cn("p-3 pointer-events-auto")} />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1"><Label className="text-xs">Installed By</Label><Input value={active.installedBy ?? ""} onChange={(e) => updateScreen(active.screenId, { installedBy: e.target.value })} placeholder="Name" /></div>
                      <div className="space-y-1"><Label className="text-xs">Last Active On</Label><p className="text-sm font-medium h-10 flex items-center">{active.lastActiveOn ? format(new Date(active.lastActiveOn), "dd MMM yyyy hh:mm a") : "—"}</p></div>
                      <div className="space-y-1">
                        <Label className="text-xs">Status</Label>
                        <Select value={active.status} onValueChange={(v: Status) => updateScreen(active.screenId, { status: v, hasDevice: v !== "Inactive" ? true : active.hasDevice })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Device Paused">Device Paused</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">Edge Appliance ID</Label><p className="text-sm font-medium">{active.applianceId || "—"}</p></div>
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">Device IP Address</Label><p className="text-sm font-medium">{active.ipAddress || "—"}</p></div>
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">Installed Date</Label><p className="text-sm font-medium">{active.installedDate ? format(new Date(active.installedDate), "dd MMM yyyy") : "—"}</p></div>
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">Installed By</Label><p className="text-sm font-medium">{active.installedBy || "—"}</p></div>
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">Last Active On</Label><p className="text-sm font-medium">{active.lastActiveOn ? format(new Date(active.lastActiveOn), "dd MMM yyyy hh:mm a") : "—"}</p></div>
                      <div className="space-y-1"><Label className="text-xs text-muted-foreground">Status</Label><p className="text-sm font-medium">{active.status}</p></div>
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

const AddEdgeTheatre = () => {
  const { lookupId } = useParams();
  const theatreQuery = useApplianceLookupTheatre("edge", lookupId);
  return (
    <QueryState query={theatreQuery} label="theatre">
      {(theatre) => <AddEdgeTheatreForm key={theatre.id} theatre={theatre} />}
    </QueryState>
  );
};

export default AddEdgeTheatre;
