import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { FlmFeed } from "@/data/flmFeedsData";
import { formatDate, formatTime } from "@/lib/dateUtils";
import { TheatreNameWithInfo } from "@/components/theatres/TheatreInfo";
import { feedTheatreDetails } from "@/data/flmFeedsData";

interface FlmDetailSheetProps {
  feed: FlmFeed | null;
  onClose: () => void;
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="grid grid-cols-2 gap-2 py-2 border-b border-border last:border-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm break-words">{value}</span>
  </div>
);

export const FlmDetailSheet = ({ feed, onClose }: FlmDetailSheetProps) => (
  <Sheet open={!!feed} onOpenChange={(open) => !open && onClose()}>
    <SheetContent className="overflow-y-auto">
      <SheetHeader>
        <SheetTitle>FLM Feed Details</SheetTitle>
      </SheetHeader>
      {feed && (
        <div className="mt-4 divide-y-0">
          <Row label="Theatre Name" value={feed.theatreName ? <TheatreNameWithInfo name={feed.theatreName} details={feedTheatreDetails(feed)} nameClassName="" /> : "—"} />
          <Row label="Theatre Display Name" value={feed.theatreDisplayName} />
          <Row label="Address" value={feed.address} />
          <Row label="Theatre UUID" value={<span className="font-mono text-xs">{feed.theatreUuid}</span>} />
          <Row label="Chain" value={feed.chain} />
          <Row label="Location" value={feed.location} />
          <Row label="Theatre ID (Feed)" value={<span className="font-mono text-xs">{feed.theatreIdFeed}</span>} />
          <Row label="Source" value={<Badge variant="outline">{feed.source}</Badge>} />
          <Row label="New Theatre?" value={feed.isNewTheatre ? "Yes" : "No"} />
          <Row
            label="Received On"
            value={`${formatDate(feed.receivedOn)} ${formatTime(feed.receivedOn)}`}
          />
          <Row
            label="Status"
            value={
              <Badge variant={feed.status === "Auto-Updated" ? "secondary" : "outline"}>
                {feed.status}
              </Badge>
            }
          />
        </div>
      )}
    </SheetContent>
  </Sheet>
);
