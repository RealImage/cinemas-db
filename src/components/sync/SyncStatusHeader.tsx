import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A sync status page's first row: a back link to the list it belongs to, and a one-line intro. */
export const SyncStatusHeader = ({ backTo, backLabel, children }: { backTo: string; backLabel: string; children: React.ReactNode }) => (
  <div className="flex items-center gap-3">
    <Button variant="ghost" size="icon" aria-label={`Back to ${backLabel}`} asChild>
      <Link to={backTo}><ArrowLeft className="h-4 w-4" /></Link>
    </Button>
    <p className="text-sm text-muted-foreground">{children}</p>
  </div>
);
