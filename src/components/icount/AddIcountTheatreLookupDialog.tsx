import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIcountLookup } from "@/hooks/api/icount";
import { cn } from "@/lib/utils";
import { common } from "@/i18n/common";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export const AddIcountTheatreLookupDialog = ({ open, onOpenChange }: Props) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The API returns only theatres not yet enrolled.
  const lookup = useIcountLookup(open);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (lookup.data ?? [])
      .filter((t) => t.theatreName.toLowerCase().includes(q) || t.theatreId.toLowerCase().includes(q))
      .slice(0, 50);
  }, [query, lookup.data]);

  const proceed = () => {
    if (!selectedId) return;
    onOpenChange(false);
    navigate(`/qube-appliances/icount-cameras/add/${selectedId}`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setQuery(""); setSelectedId(null); } }}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Add Theatre</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Enter Theatre Name or Theatre ID"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedId(null); }}
              className="pl-9"
            />
          </div>
          <div className="border rounded-md">
            <ScrollArea className="h-72">
              {lookup.isPending ? (
                <p className="text-sm text-muted-foreground p-4 text-center" role="status">Loading theatres…</p>
              ) : lookup.isError ? (
                <div className="p-4 text-center space-y-2" role="alert">
                  <p className="text-sm text-red-500">Could not load theatres: {lookup.error.message}</p>
                  <Button variant="outline" size="sm" onClick={() => lookup.refetch()}>Retry</Button>
                </div>
              ) : query.trim() === "" ? (
                <p className="text-sm text-muted-foreground p-4 text-center">Start typing to find theatres.</p>
              ) : matches.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">No matching theatres found.</p>
              ) : (
                <ul className="divide-y">
                  {matches.map((t) => (
                    <li
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      className={cn("px-3 py-2 cursor-pointer hover:bg-muted/60", selectedId === t.id && "bg-muted")}
                    >
                      <div className="font-medium text-sm">{t.theatreName} <span className="text-muted-foreground font-normal">({t.theatreId})</span></div>
                      <div className="text-xs text-muted-foreground">{t.chainName} • {t.city}, {t.state}, {t.country} • {t.totalScreens} screens</div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{common.cancel}</Button>
          <Button onClick={proceed} disabled={!selectedId}>Proceed</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
