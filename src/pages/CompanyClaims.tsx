import { useState } from "react";
import { DataTable, Column } from "@/components/ui/data-table";
import { CompanyClaim } from "@/data/companyClaimsData";
import { useCompanyClaims } from "@/hooks/api/approvals";
import { QueryState } from "@/components/ui/query-state";
import { ClaimDetailSheet } from "@/components/company-claims/ClaimDetailSheet";
import { formatDate } from "@/lib/dateUtils";

/** Distinct values of a field, for a column's filter options. */
const optionsFor = (key: keyof CompanyClaim) => (rows: CompanyClaim[]) =>
  Array.from(new Set(rows.map((r) => String(r[key])))).sort((a, b) => a.localeCompare(b));

const columns: Column<CompanyClaim>[] = [
  { header: "Company", accessor: "company", sortable: true },
  { header: "Location", accessor: "location", sortable: true, filterable: true, filterOptions: optionsFor("location") },
  { header: "Company Type", accessor: "companyType", sortable: true, filterable: true, filterOptions: optionsFor("companyType") },
  { header: "Chain Claims", accessor: "chainClaims", sortable: true },
  { header: "Theatre Claims", accessor: "theatreClaims", sortable: true },
  {
    header: "Last Claimed On",
    accessor: "lastClaimedOn",
    sortable: true,
    filterable: true,
    filterType: "dateRange",
    cell: (row) => formatDate(row.lastClaimedOn),
  },
];

const CompanyClaims = () => {
  const claimsQuery = useCompanyClaims();
  const [selectedClaim, setSelectedClaim] = useState<CompanyClaim | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleRowClick = (row: CompanyClaim) => {
    setSelectedClaim(row);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Review and manage pending company claims.
      </p>
      <QueryState query={claimsQuery} label="company claims">
        {(claims) => (
          <DataTable
            data={claims}
            exportName="Company Claims"
            columns={columns}
            searchable
            searchPlaceholder="Search claims..."
            onRowClick={handleRowClick}
          />
        )}
      </QueryState>
      <ClaimDetailSheet
        claim={selectedClaim}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
};

export default CompanyClaims;
