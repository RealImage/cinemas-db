import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { common } from "@/i18n/common";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const SystemConstantsDialog = ({ open, onOpenChange }: Props) => {
  const [form, setForm] = useState({
    radius: "100",
    androidVersion: "10.0",
    iosVersion: "14.0",
    serverUsername: "",
    serverPassword: "",
  });

  const update = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => {
    toast.success("System constants saved");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>System Constants</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="radius" className="text-xs text-muted-foreground">Radius (in m)</Label>
            <Input
              id="radius"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={form.radius}
              onChange={(e) => update("radius", e.target.value.replace(/[^0-9]/g, ""))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="android" className="text-xs text-muted-foreground">Supported Android Version</Label>
            <Input id="android" value={form.androidVersion} onChange={(e) => update("androidVersion", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ios" className="text-xs text-muted-foreground">Supported iOS Version</Label>
            <Input id="ios" value={form.iosVersion} onChange={(e) => update("iosVersion", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="srvUser" className="text-xs text-muted-foreground">Server Username</Label>
            <Input id="srvUser" value={form.serverUsername} onChange={(e) => update("serverUsername", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="srvPass" className="text-xs text-muted-foreground">Server Password</Label>
            <Input id="srvPass" type="password" value={form.serverPassword} onChange={(e) => update("serverPassword", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{common.cancel}</Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SystemConstantsDialog;