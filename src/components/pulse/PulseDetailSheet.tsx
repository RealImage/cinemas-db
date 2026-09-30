import { useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Pencil, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PulseTheatre } from "@/data/pulseData";
import { cn } from "@/lib/utils";
import { TheatreNameWithInfo } from "@/components/theatres/TheatreInfo";

interface Props {
  theatre: PulseTheatre | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (theatre: PulseTheatre) => void;
}

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="space-y-1">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-sm font-medium">{value || "—"}</p>
  </div>
);

const statusColor = (s: string) =>
  s === "Active"
    ? "bg-[hsl(142_76%_36%)] hover:bg-[hsl(142_76%_36%)]"
    : s === "Device Paused"
    ? "bg-[hsl(25_95%_53%)] hover:bg-[hsl(25_95%_53%)]"
    : "bg-muted text-muted-foreground hover:bg-muted";

export const PulseDetailSheet = ({ theatre, open, onOpenChange, onEdit }: Props) => {
  const [openScreens, setOpenScreens] = useState<Record<string, boolean>>({});
  if (!theatre) return null;
  const activeScreens = theatre.screens.filter((s) => s.hasDevice && s.status === "Active");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="px-5 py-4 border-b">
          <SheetTitle className="flex items-center justify-between gap-2 pr-8">
            <TheatreNameWithInfo name={theatre.theatreName} theatreRef={theatre.id} className="min-w-0" nameClassName="truncate" />
            <span className="text-xs font-normal text-muted-foreground">{theatre.theatreId}</span>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Theatre Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Theatre Name & ID" value={<><TheatreNameWithInfo name={theatre.theatreName} theatreRef={theatre.id} nameClassName="" /> ({theatre.theatreId})</>} />
                <Field label="Theatre Location" value={`${theatre.city}, ${theatre.state}, ${theatre.country}`} />
                <Field label="Latitude" value={theatre.latitude.toFixed(6)} />
                <Field label="Longitude" value={theatre.longitude.toFixed(6)} />
                <Field label="Network ID" value={theatre.networkId} />
                <Field label="Network Password" value={theatre.networkPassword ? "••••••••" : "—"} />
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Screen Details</h3>
                <Badge variant="secondary">{activeScreens.length} active</Badge>
              </div>
              {activeScreens.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No active Pulse devices.</p>
              ) : (
                <div className="space-y-2">
                  {activeScreens.map((s) => {
                    const isOpen = openScreens[s.screenId] ?? true;
                    return (
                      <Collapsible
                        key={s.screenId}
                        open={isOpen}
                        onOpenChange={(v) => setOpenScreens((p) => ({ ...p, [s.screenId]: v }))}
                      >
                        <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <span className="text-sm font-medium flex-1">{s.screenName}</span>
                          <span className="text-xs text-muted-foreground">{s.screenId}</span>
                          <Badge className={cn("text-[10px]", statusColor(s.status))}>{s.status}</Badge>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="grid grid-cols-2 gap-4 px-3 py-3 border border-t-0 rounded-b-md">
                            <Field label="Pulse Appliance ID" value={s.applianceId} />
                            <Field label="Device IP Address" value={s.ipAddress} />
                            <Field label="Installed Date" value={s.installedDate ? format(new Date(s.installedDate), "dd MMM yyyy") : null} />
                            <Field label="Installed By" value={s.installedBy} />
                            <Field label="Last Active On" value={s.lastActiveOn ? format(new Date(s.lastActiveOn), "dd MMM yyyy hh:mm a") : null} />
                            <Field label="Status" value={s.status} />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </ScrollArea>

        <SheetFooter className="px-5 py-3 border-t flex-row sm:justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" /> Close
          </Button>
          <Button onClick={() => onEdit(theatre)}>
            <Pencil className="h-4 w-4 mr-2" /> Edit Details
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
