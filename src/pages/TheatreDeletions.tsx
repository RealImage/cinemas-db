import { useState } from "react";
import { toast } from "sonner";
import { DataTable, Column } from "@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QueryState } from "@/components/ui/query-state";
import { PermanentDeleteTheatreDialog, type PermanentDeleteTarget } from "@/components/theatres/TheatreDeletionDialogs";
import { permanentDeleteAllowed, useNow, useRestoreTheatreAction } from "@/components/theatres/theatreDeletion";
import { useReviewTheatreDeletion, useTheatreDeletions } from "@/hooks/api/approvals";
import { TheatreNameWithInfo } from "@/components/theatres/TheatreInfo";
import { formatDateTime } from "@/lib/dateUtils";
import { common } from "@/i18n/common";
import { THEATRE_PERMANENT_DELETE_HOURS, type TheatreDeletionRequest } from "@/types";

type Review = { request: TheatreDeletionRequest; decision: "approve" | "reject" };

const baseColumns: Column<TheatreDeletionRequest>[] = [
  { header: "Theatre", accessor: "theatreName", sortable: true, cell: (r) => <TheatreNameWithInfo name={r.theatreName} theatreRef={r.theatreId} nameClassName="" /> },
  { header: "Chain", accessor: "chainName", sortable: true },
  { header: "City", accessor: "city", sortable: true },
  { header: "Screens", accessor: "screenCount", sortable: true },
  { header: "Reason", accessor: "reason", sortable: true },
  { header: "Comments", accessor: "comments" },
  { header: "Requested By", accessor: "requestedBy", sortable: true },
  { header: "Requested On", accessor: "requestedAt", sortable: true, cell: (r) => formatDateTime(r.requestedAt) },
];

/** Approve (with optional comments) or reject (comments required) a deletion request. */
function ReviewDialog({ review, onOpenChange }: { review: Review | null; onOpenChange: (open: boolean) => void }) {
  const [comments, setComments] = useState("");
  const [tried, setTried] = useState(false);
  const mutation = useReviewTheatreDeletion();
  const rejecting = review?.decision === "reject";

  const handleOpenChange = (open: boolean) => {
    if (!open) { setComments(""); setTried(false); }
    onOpenChange(open);
  };
  const confirm = async () => {
    if (!review) return;
    if (rejecting && !comments.trim()) { setTried(true); return; }
    const name = review.request.theatreName;
    try {
      await mutation.mutateAsync({ id: review.request.id, decision: review.decision, comments });
      toast.success(rejecting ? `Deletion of "${name}" rejected` : `"${name}" is deleted. It can be restored until it's deleted permanently.`);
      handleOpenChange(false);
    } catch (err) {
      toast.error(`Could not ${review.decision} the request: ${(err as Error).message}`);
    }
  };

  return (
    <Dialog open={!!review} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rejecting ? "Reject" : "Approve"} deletion of {review?.request.theatreName}</DialogTitle>
          <DialogDescription>
            {rejecting
              ? "The theatre stays as it is. Say why the deletion is rejected."
              : `The theatre is marked Deleted and can no longer be edited. It can be restored, or deleted permanently ${THEATRE_PERMANENT_DELETE_HOURS} hours from now.`}
          </DialogDescription>
        </DialogHeader>
        {review && (
          <p className="text-sm">
            <span className="text-muted-foreground">Reason:</span> {review.request.reason}
            {review.request.comments && <> ({review.request.comments})</>}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="deletion-review-comments">{rejecting ? "Comments" : "Comments (optional)"}</Label>
          <Textarea
            id="deletion-review-comments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            aria-invalid={tried && rejecting && !comments.trim()}
            aria-describedby={tried && rejecting && !comments.trim() ? "deletion-review-comments-error" : undefined}
          />
          {tried && rejecting && !comments.trim() && (
            <p id="deletion-review-comments-error" role="alert" className="text-xs text-red-500">Say why the deletion is rejected</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>{common.cancel}</Button>
          <Button variant={rejecting ? "destructive" : "default"} onClick={confirm} loading={mutation.isPending}>
            {common.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PendingTab() {
  const query = useTheatreDeletions("pending");
  const [review, setReview] = useState<Review | null>(null);
  const columns: Column<TheatreDeletionRequest>[] = [
    ...baseColumns,
    {
      header: "Actions",
      accessor: (r) => r.id,
      cell: (r) => (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setReview({ request: r, decision: "approve" })}>Approve</Button>
          <Button size="sm" variant="outline" onClick={() => setReview({ request: r, decision: "reject" })}>Reject</Button>
        </div>
      ),
    },
  ];
  return (
    <>
      <QueryState query={query} label="deletion requests">
        {(rows) => <DataTable data={rows} columns={columns} searchable searchPlaceholder="Search requests..." />}
      </QueryState>
      <ReviewDialog review={review} onOpenChange={(open) => { if (!open) setReview(null); }} />
    </>
  );
}

function DeletedTab() {
  const query = useTheatreDeletions("deleted");
  const now = useNow();
  const restore = useRestoreTheatreAction();
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<PermanentDeleteTarget | null>(null);

  const columns: Column<TheatreDeletionRequest>[] = [
    ...baseColumns.filter((c) => c.header !== "Comments"),
    { header: "Deleted On", accessor: "deletedAt", sortable: true, cell: (r) => (r.deletedAt ? formatDateTime(r.deletedAt) : "") },
    { header: "Approved By", accessor: "deletedBy", sortable: true },
    {
      header: "Permanent Delete From",
      accessor: "permanentDeleteFrom",
      sortable: true,
      cell: (r) => (r.permanentDeleteFrom ? formatDateTime(r.permanentDeleteFrom) : ""),
    },
    {
      header: "Actions",
      accessor: (r) => r.id,
      cell: (r) => {
        const allowed = permanentDeleteAllowed(r.permanentDeleteFrom, now);
        return (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              loading={restoring === r.theatreId}
              onClick={async () => {
                setRestoring(r.theatreId);
                await restore({ id: r.theatreId, name: r.theatreName });
                setRestoring(null);
              }}
            >
              Restore
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={!allowed}
              title={allowed ? undefined : `Available from ${r.permanentDeleteFrom ? formatDateTime(r.permanentDeleteFrom) : "—"}`}
              onClick={() => setDeleting({ id: r.theatreId, name: r.theatreName, permanentDeleteFrom: r.permanentDeleteFrom })}
            >
              Delete permanently
            </Button>
          </div>
        );
      },
    },
  ];
  return (
    <>
      <QueryState query={query} label="deleted theatres">
        {(rows) => <DataTable data={rows} columns={columns} searchable searchPlaceholder="Search deleted theatres..." />}
      </QueryState>
      <PermanentDeleteTheatreDialog theatre={deleting} onOpenChange={(open) => { if (!open) setDeleting(null); }} />
    </>
  );
}

/** Approvals & Conflicts → Theatre Deletions: approve or reject requests; restore or permanently delete deleted theatres. */
const TheatreDeletions = () => (
  <div className="space-y-4">
    <p className="text-sm text-muted-foreground">
      Approving a request marks the theatre Deleted. A deleted theatre can be restored, or deleted permanently
      (with its screens and change history) {THEATRE_PERMANENT_DELETE_HOURS} hours after the approval.
    </p>
    <Tabs defaultValue="pending">
      <TabsList>
        <TabsTrigger value="pending">Pending</TabsTrigger>
        <TabsTrigger value="deleted">Deleted</TabsTrigger>
      </TabsList>
      <TabsContent value="pending"><PendingTab /></TabsContent>
      <TabsContent value="deleted"><DeletedTab /></TabsContent>
    </Tabs>
  </div>
);

export default TheatreDeletions;
