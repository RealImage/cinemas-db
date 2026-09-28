import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Screen } from "@/types";
import { IPSuitesTabContent } from "@/components/theatres/ip-suites/IPSuitesTabContent";
import { QueryState } from "@/components/ui/query-state";
import { useTheatre } from "@/hooks/api/theatres";
import { useSaveScreenDeviceConfig } from "@/hooks/api/screens";
import { ApiError } from "@/lib/api";
import { common } from "@/i18n/common";

const EditScreenDeviceList = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const theatreQuery = useTheatre(id);
  const saveConfig = useSaveScreenDeviceConfig();
  const theatre = theatreQuery.data;
  // Working copy of the screens; edited in place and saved on "Save Changes".
  const [screens, setScreens] = useState<Screen[]>([]);
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  // Hydrate once per theatre; background refetches must not discard unsaved edits.
  const hydratedId = useRef<string | null>(null);
  useEffect(() => {
    if (theatre && hydratedId.current !== theatre.id) {
      hydratedId.current = theatre.id;
      setScreens(theatre.screens ?? []);
      setDirty(new Set());
    }
  }, [theatre]);

  useEffect(() => {
    if (theatreQuery.error instanceof ApiError && theatreQuery.error.status === 404) {
      toast.error("Theatre not found");
      navigate("/theatre-device-management/screen-devices");
    }
  }, [theatreQuery.error, navigate]);

  const screensForTab = useMemo(() => screens, [screens]);

  const handleSave = async () => {
    const changed = screens.filter((s) => dirty.has(s.id));
    try {
      if (changed.length > 0) {
        await saveConfig.mutateAsync(
          changed.map((s) => ({ id: s.id, devices: s.devices, ipAddresses: s.ipAddresses, suites: s.suites })),
        );
      }
      toast.success("Screen device list saved");
      navigate("/theatre-device-management/screen-devices");
    } catch (err) {
      toast.error(`Could not save screen device list: ${(err as Error).message}`);
    }
  };

  if (!theatre) return <QueryState query={theatreQuery} label="theatre">{() => null}</QueryState>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("/theatre-device-management/screen-devices")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-semibold">{theatre.name}</h2>
          <p className="text-sm text-muted-foreground">
            {theatre.chainName} · {theatre.city}, {theatre.state}, {theatre.country}
          </p>
        </div>
        <Button onClick={handleSave} loading={saveConfig.isPending} className="min-w-20">
          {common.save}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Theatre Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Theatre Name</Label>
            <Input value={theatre.name} readOnly />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Theatre ID</Label>
            <Input value={theatre.id} readOnly />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Chain</Label>
            <Input value={theatre.chainName} readOnly />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Location</Label>
            <Input value={`${theatre.city}, ${theatre.state}, ${theatre.country}`} readOnly />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Screens</Label>
            <Input value={String(theatre.screenCount)} readOnly />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Input value={theatre.status} readOnly />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Screen Details</CardTitle>
        </CardHeader>
        <CardContent>
          <IPSuitesTabContent
            screens={screensForTab}
            onScreenDataChange={(screenId, dataType, data) => {
              setScreens((prev) => prev.map((s) => (s.id === screenId ? { ...s, [dataType]: data } : s)));
              setDirty((prev) => new Set(prev).add(screenId));
            }}
          />
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default EditScreenDeviceList;