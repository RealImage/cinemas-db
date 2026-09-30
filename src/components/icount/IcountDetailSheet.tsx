import { useState } from "react";
import { ChevronDown, ChevronRight, Pencil, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IcountTheatre } from "@/data/icountData";
import { TheatreNameWithInfo } from "@/components/theatres/TheatreInfo";

interface Props {
  theatre: IcountTheatre | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (theatre: IcountTheatre) => void;
}

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="space-y-1">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-sm font-medium">{value || "—"}</p>
  </div>
);

export const IcountDetailSheet = ({ theatre, open, onOpenChange, onEdit }: Props) => {
  const [openScreens, setOpenScreens] = useState<Record<string, boolean>>({});
  if (!theatre) return null;
  const camScreens = theatre.screens.filter((s) => s.hasCameras);

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
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Screens with iCount Cameras</h3>
                <Badge variant="secondary">{camScreens.length} screens</Badge>
              </div>
              {camScreens.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No iCount cameras installed.</p>
              ) : (
                <div className="space-y-2">
                  {camScreens.map((s) => {
                    const isOpen = openScreens[s.screenId] ?? true;
                    return (
                      <Collapsible key={s.screenId} open={isOpen} onOpenChange={(v) => setOpenScreens((p) => ({ ...p, [s.screenId]: v }))}>
                        <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <span className="text-sm font-medium flex-1">{s.screenName}</span>
                          <span className="text-xs text-muted-foreground">{s.screenId}</span>
                          <Badge variant="secondary" className="text-[10px]">{s.cameras.length} camera{s.cameras.length !== 1 ? "s" : ""}</Badge>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="border border-t-0 rounded-b-md divide-y">
                            {s.cameras.map((c) => (
                              <div key={c.cameraId} className="px-3 py-3 space-y-2">
                                <p className="text-xs font-semibold">{c.label}</p>
                                <div className="grid grid-cols-2 gap-4">
                                  <Field label="Make" value={c.make} />
                                  <Field label="Model" value={c.model} />
                                  <Field label="Serial Number" value={c.serialNumber} />
                                  <Field label="Ownership" value={c.ownership} />
                                  <Field label="IP Address" value={c.ipAddress} />
                                </div>
                              </div>
                            ))}
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
