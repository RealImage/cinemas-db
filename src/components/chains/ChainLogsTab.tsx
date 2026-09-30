import { ArrowRight, Calendar, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { QueryState } from "@/components/ui/query-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dateUtils";
import { useChainLogs } from "@/hooks/api/chains";
import type { ChainDetails } from "@/data/chainDetails";

const actionColor = (action: string) => {
  switch (action) {
    case "Created": return "text-green-600 bg-green-50 border-green-200";
    case "Updated": return "text-blue-600 bg-blue-50 border-blue-200";
    case "Deleted": return "text-red-600 bg-red-50 border-red-200";
    default: return "text-gray-600 bg-gray-50 border-gray-200";
  }
};

const Value = ({ v }: { v: string | null }) =>
  v ? <span className="whitespace-pre-line break-words">{v}</span> : <span className="text-muted-foreground">—</span>;

/** The chain's change history, newest first (like the theatre Change History, inline). */
export function ChainLogsTab({ chain }: { chain: ChainDetails }) {
  const logs = useChainLogs(chain.id);
  return (
    <Card className="p-0">
      <QueryState query={logs} label="logs">
        {(rows) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[170px]">Date/Time</TableHead>
                <TableHead className="w-[160px]">Section</TableHead>
                <TableHead className="w-[200px]">Action</TableHead>
                <TableHead>Change</TableHead>
                <TableHead className="w-[150px]">Updated By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No changes recorded yet</TableCell></TableRow>
              )}
              {rows.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">
                    <span className="flex items-center"><Calendar className="mr-2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />{formatDateTime(log.date)}</span>
                  </TableCell>
                  <TableCell className="text-sm">{log.section}</TableCell>
                  <TableCell className="text-sm">
                    <span className={`mr-2 rounded-full border px-2 py-1 text-xs font-medium ${actionColor(log.action)}`}>{log.action}</span>
                    {log.field}
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="flex flex-wrap items-center gap-2">
                      <Value v={log.oldValue} />
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="changed to" />
                      <Value v={log.newValue} />
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="flex items-center"><User className="mr-2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />{log.updatedBy}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </QueryState>
    </Card>
  );
}
