import { useState } from "react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { QueryState } from "@/components/ui/query-state";
import { TheatreNameWithInfo } from "@/components/theatres/TheatreInfo";
import { ViewTheatreDialog } from "@/components/ViewTheatreDialog";
import { useChainTheatres } from "@/hooks/api/chains";
import { useTheatre } from "@/hooks/api/theatres";
import type { ChainDetails, ChainTheatre } from "@/data/chainDetails";

const location = (t: ChainTheatre) => [t.city, t.state, t.country].filter(Boolean).join(", ");

const optionsFor = (read: (t: ChainTheatre) => string) => (rows: ChainTheatre[]) =>
  Array.from(new Set(rows.map(read).filter(Boolean))).sort((a, b) => a.localeCompare(b));

const columns: Column<ChainTheatre>[] = [
  {
    header: "Theatre Name",
    accessor: "name",
    sortable: true,
    cell: (t) => <TheatreNameWithInfo name={t.name} theatreRef={t.id} />,
  },
  { header: "Location", accessor: location, sortable: true },
  { header: "Country", accessor: "country", sortable: true, filterable: true, filterOptions: optionsFor((t) => t.country) },
  {
    header: "Status",
    accessor: "status",
    filterable: true,
    filterOptions: optionsFor((t) => t.status),
    cell: (t) => (
      <span className={`rounded-full px-2 py-1 text-xs font-medium ${t.status === "Active" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
        {t.status}
      </span>
    ),
  },
  { header: "Screens", accessor: "screenCount", sortable: true },
];

/** The chain's theatres; a row opens the theatre, as in the Theatre List. */
export function ChainTheatresTab({ chain }: { chain: ChainDetails }) {
  const theatres = useChainTheatres(chain.id);
  const [viewingId, setViewingId] = useState<string | undefined>();
  const viewing = useTheatre(viewingId);
  return (
    <>
      <QueryState query={theatres} label="theatres">
        {(rows) => (
          <DataTable
            data={rows}
            columns={columns}
            exportName={`${chain.name} theatres`}
            searchPlaceholder="Search theatres..."
            onRowClick={(t) => setViewingId(t.id)}
          />
        )}
      </QueryState>
      <ViewTheatreDialog
        open={!!viewingId && !!viewing.data}
        onOpenChange={(open) => { if (!open) setViewingId(undefined); }}
        theatre={viewing.data}
      />
    </>
  );
}
