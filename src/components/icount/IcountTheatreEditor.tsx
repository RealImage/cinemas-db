import { useState } from "react";
import { FormActions } from "@/components/ui/form-actions";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, CheckCircle2, Circle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { IcountCamera, IcountScreen, makeEmptyCamera } from "@/data/icountData";
import EditIcountCameraDialog from "./EditIcountCameraDialog";
import type { IcountCamerasInput } from "@/hooks/api/icount";
import { common } from "@/i18n/common";

const LIST_PATH = "/qube-appliances/icount-cameras";

interface Props {
  heading: string;
  theatreName: string;
  theatreId: string;
  location: string;
  latitude: number;
  longitude: number;
  initialScreens: IcountScreen[];
  successMessage: string;
  /** Persist the edited theatre; rejects with the API error. */
  onSave: (input: IcountCamerasInput) => Promise<unknown>;
  saving?: boolean;
}

const Field = ({ label, value }: { label: string; value?: React.ReactNode }) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <p className="text-sm font-medium">{value || "—"}</p>
  </div>
);

export const IcountTheatreEditor = ({
  heading, theatreName, theatreId, location, latitude, longitude, initialScreens, successMessage, onSave: save, saving,
}: Props) => {
  const navigate = useNavigate();
  const [editDetails, setEditDetails] = useState(false);
  const [details, setDetails] = useState({ latitude, longitude });
  const [screens, setScreens] = useState<IcountScreen[]>(initialScreens);
  const [activeScreenId, setActiveScreenId] = useState<string | null>(null);
  const [editingCameraId, setEditingCameraId] = useState<string | null>(null);

  const active = screens.find((s) => s.screenId === activeScreenId) ?? screens[0];
  const editingCamera = active?.cameras.find((c) => c.cameraId === editingCameraId) ?? null;

  const updateScreen = (sid: string, patch: Partial<IcountScreen>) =>
    setScreens((prev) => prev.map((s) => (s.screenId === sid ? { ...s, ...patch } : s)));

  const updateCamera = (sid: string, cid: string, patch: Partial<IcountCamera>) =>
    setScreens((prev) =>
      prev.map((s) =>
        s.screenId === sid
          ? { ...s, cameras: s.cameras.map((c) => (c.cameraId === cid ? { ...c, ...patch } : c)) }
          : s
      )
    );

  const addCamera = (s: IcountScreen) =>
    updateScreen(s.screenId, { cameras: [...s.cameras, makeEmptyCamera(s.cameras.length + 1, s.screenId)] });

  const removeCamera = (s: IcountScreen, cid: string) =>
    updateScreen(s.screenId, {
      cameras: s.cameras
        .filter((c) => c.cameraId !== cid)
        .map((c, i) => ({ ...c, label: `Camera ${i + 1}` })),
    });

  const onSave = () => {
    save({ ...details, screens }).then(
      () => {
        toast.success(successMessage);
        navigate(LIST_PATH);
      },
      (err: Error) => toast.error(`Could not save ${theatreName}: ${err.message}`),
    );
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to={LIST_PATH}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{heading}</h2>
            <p className="text-sm text-muted-foreground">{theatreName} ({theatreId})</p>
          </div>
        </div>
        <FormActions>
          <Button variant="outline" onClick={() => navigate(LIST_PATH)}>{common.cancel}</Button>
          <Button onClick={onSave} loading={saving}>{common.save}</Button>
        </FormActions>
      </div>

      {/* Theatre Details */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Theatre Details</h3>
          <Button variant="outline" size="sm" onClick={() => setEditDetails((v) => !v)}>
            <Pencil className="h-3.5 w-3.5 mr-2" />{editDetails ? "Done" : "Edit"}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Theatre Name & ID" value={<>{theatreName} <span className="text-muted-foreground">({theatreId})</span></>} />
          <Field label="Theatre Location" value={location} />
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
        </div>
      </Card>

      {/* Screens + Cameras */}
      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr]">
          <div className="border-r bg-muted/20">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">Screens</h3>
              <p className="text-xs text-muted-foreground">
                {screens.filter((s) => s.hasCameras).length} of {screens.length} with cameras
              </p>
            </div>
            <ScrollArea className="h-[480px]">
              <ul className="p-2 space-y-1">
                {screens.map((s) => {
                  const enabled = s.hasCameras;
                  const selected = active?.screenId === s.screenId;
                  return (
                    <li key={s.screenId}>
                      <button type="button" onClick={() => setActiveScreenId(s.screenId)}
                        className={cn(
                          "w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors border",
                          selected ? "border-primary" : "border-transparent",
                          enabled
                            ? "bg-[hsl(142_76%_36%/0.12)] text-[hsl(142_76%_28%)] hover:bg-[hsl(142_76%_36%/0.18)]"
                            : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                        )}>
                        <Checkbox checked={enabled}
                          onCheckedChange={(c) => updateScreen(s.screenId, { hasCameras: Boolean(c) })}
                          onClick={(e) => e.stopPropagation()}
                          className={cn(enabled && "border-[hsl(142_76%_36%)] data-[state=checked]:bg-[hsl(142_76%_36%)]")} />
                        <span className="flex-1">{s.screenName}</span>
                        {enabled
                          ? <CheckCircle2 className="h-4 w-4 text-[hsl(142_76%_36%)]" />
                          : <Circle className="h-4 w-4 text-muted-foreground/60" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </div>

          <div className="p-5">
            {!active ? (
              <p className="text-sm text-muted-foreground">No screens available.</p>
            ) : (
              <div className="space-y-6">
                <section className="space-y-3">
                  <h4 className="text-sm font-semibold">Screen Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Screen Name" value={active.screenName} />
                    <Field label="Screen ID" value={active.screenId} />
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">iCount Cameras</h4>
                    <div className="flex items-center gap-2">
                      {active.hasCameras && (
                        <Badge className="bg-[hsl(142_76%_36%)] hover:bg-[hsl(142_76%_36%)]">Enabled</Badge>
                      )}
                      <Button variant="outline" size="sm" onClick={() => addCamera(active)}>
                        <Plus className="h-3.5 w-3.5 mr-2" /> Add Camera
                      </Button>
                    </div>
                  </div>

                  {active.cameras.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No iCount camera is available at this screen.</p>
                  ) : (
                    <div className="space-y-3">
                      {active.cameras.map((c) => (
                        <div key={c.cameraId} className="rounded-md border p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">{c.label}</p>
                            <div className="flex items-center gap-1">
                              <Button variant="outline" size="sm" onClick={() => setEditingCameraId(c.cameraId)}>
                                <Pencil className="h-3.5 w-3.5 mr-2" />{c.make ? "Edit" : "Add"}
                              </Button>
                              {active.cameras.length > 1 && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeCamera(active, c.cameraId)} aria-label="Remove camera">
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Field label="Make" value={c.make} />
                            <Field label="Model" value={c.model} />
                            <Field label="Serial Number" value={c.serialNumber} />
                            <Field label="Ownership" value={c.ownership} />
                            <Field label="IP Address" value={c.ipAddress} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      </Card>

      <EditIcountCameraDialog
        open={!!editingCamera}
        onOpenChange={(o) => !o && setEditingCameraId(null)}
        camera={editingCamera}
        screenName={active?.screenName}
        onSave={(patch) => {
          if (active && editingCamera) {
            updateCamera(active.screenId, editingCamera.cameraId, patch);
            if (!active.hasCameras) updateScreen(active.screenId, { hasCameras: true });
          }
        }}
      />
    </div>
  );
};

export default IcountTheatreEditor;
