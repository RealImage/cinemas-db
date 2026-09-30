import { useState } from "react";
import { DataTable, Column } from "@/components/ui/data-table";
import { PartnerRequest } from "@/data/partnersData";
import { usePartnerRequests } from "@/hooks/api/approvals";
import { QueryState } from "@/components/ui/query-state";
import { PartnerDetailSheet } from "@/components/partners/PartnerDetailSheet";
import { formatDate } from "@/lib/dateUtils";

/** Distinct values of a field, for a column's filter options. */
const optionsFor = (key: keyof PartnerRequest) => (rows: PartnerRequest[]) =>
  Array.from(new Set(rows.map((r) => String(r[key])))).sort((a, b) => a.localeCompare(b));

const columns: Column<PartnerRequest>[] = [
  { header: "Company", accessor: "company", sortable: true },
  { header: "Company Role", accessor: "companyRole", sortable: true, filterable: true, filterOptions: optionsFor("companyRole") },
  { header: "Location", accessor: "location", sortable: true, filterable: true, filterOptions: optionsFor("location") },
  { header: "Requested By", accessor: "requestedBy", sortable: true, filterable: true, filterOptions: optionsFor("requestedBy") },
  {
    header: "Request Created On",
    accessor: "requestCreatedOn",
    sortable: true,
    filterable: true,
    filterType: "dateRange",
    cell: (row) => formatDate(row.requestCreatedOn),
  },
];

const Partners = () => {
  const partnersQuery = usePartnerRequests();
  const [selectedPartner, setSelectedPartner] = useState<PartnerRequest | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleRowClick = (row: PartnerRequest) => {
    setSelectedPartner(row);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Review and manage pending partner requests.
      </p>
      <QueryState query={partnersQuery} label="partner requests">
        {(partners) => (
          <DataTable
            data={partners}
            exportName="Partners"
            columns={columns}
            searchable
            searchPlaceholder="Search partners..."
            onRowClick={handleRowClick}
          />
        )}
      </QueryState>
      <PartnerDetailSheet
        partner={selectedPartner}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
};

export default Partners;
