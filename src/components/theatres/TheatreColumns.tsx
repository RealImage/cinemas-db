
import React from "react";
import { Film, Calendar, User } from "lucide-react";
import { Column } from "@/components/ui/data-table"; // Import the Column type from data-table
import { formatDate } from "@/lib/dateUtils";
import { TheatreNameWithInfo } from "@/components/theatres/TheatreInfo";
import { TagButton } from "@/components/theatres/TheatreTags";
import { formatTheatreAddress } from "@/data/theatreSummary";
import { THEATRE_LISTINGS } from "@/types";
import { LISTING_NOT_SET, type TheatreFacets, type TheatrePage, type TheatreTag } from "@/data/theatreSearch";

/** A Theatre List row: a theatre, plus what matched when the list is searched. */
export type TheatreListRow = TheatrePage["rows"][number];

/** Theatre List columns. Chain, company, location and ad-integrator values are tags: clicking one filters by it. */
export const useTheatreColumns = ({ onTag }: { onTag: (tag: TheatreTag) => void }): Column<TheatreListRow>[] => {
  const columns: Column<TheatreListRow>[] = [
    {
      header: "Theatre Name",
      accessor: "name",
      cell: (row) => (
        <div>
          <TheatreNameWithInfo name={row.name} theatreRef={row.id} nameClassName="" />
          {row.match && row.match.field !== "Name" && (
            <div className="max-w-[260px] truncate text-xs text-muted-foreground" title={`${row.match.field}: ${row.match.value}`}>
              {row.match.field}: <span className="font-mono">{row.match.value}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: "Display Name",
      accessor: "displayName"
    },
    {
      header: "Chain Name",
      accessor: "chainName",
      cell: (row) => row.chainName ? <TagButton tag={{ kind: "chain", value: row.chainName }} onTag={onTag} /> : null,
    },
    {
      header: "Company",
      accessor: "companyName",
      cell: (row) => row.companyName ? <TagButton tag={{ kind: "owner", value: row.companyName }} onTag={onTag} /> : null,
    },
    {
      header: "Location",
      accessor: "address",
      exportValue: (row) => formatTheatreAddress(row),
      cell: (row) => {
        const places: TheatreTag[] = [
          { kind: "city", value: row.city },
          { kind: "province", value: row.state },
          { kind: "country", value: row.country },
        ].filter((t): t is TheatreTag => !!t.value);
        if (!places.length) return <span className="text-xs text-muted-foreground">{row.address || "Not set"}</span>;
        return (
          <div className="flex max-w-[240px] flex-wrap gap-1" title={row.address || undefined}>
            {places.map((tag) => <TagButton key={tag.kind} tag={tag} onTag={onTag} />)}
          </div>
        );
      },
    },
    {
      header: "Status",
      accessor: "status",
      cell: (row) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          row.status === "Active" 
            ? "bg-green-100 text-green-800" 
            : row.status === "Inactive" 
              ? "bg-yellow-100 text-yellow-800" 
              : "bg-red-100 text-red-800"
        }`}>
          {row.status}
        </span>
      )
    },
    {
      header: "Listing",
      accessor: "listing",
      exportValue: (row) => row.listing || LISTING_NOT_SET,
      cell: (row) => row.listing
        ? <span className="whitespace-nowrap text-sm">{row.listing}</span>
        : <span className="text-xs text-muted-foreground">{LISTING_NOT_SET}</span>,
    },
    {
      header: "Ad Integrators",
      accessor: "adIntegrators",
      cell: (row) => {
        const adIntegrators = row.adIntegrators ?? [];
        
        return (
          <div className="space-y-1">
            {adIntegrators.length > 0 ? (
              <div className="flex flex-col items-start gap-1">
                {adIntegrators.map((integrator) => (
                  <TagButton key={integrator} tag={{ kind: "adIntegrator", value: integrator }} onTag={onTag} />
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground text-xs">None</span>
            )}
          </div>
        );
      }
    },
    {
      header: "WireTAP",
      accessor: "wireTap",
      exportValue: (row) => (row.wireTAPDevices ?? []).map((d) => d.serialNumber).join(", "),
      cell: (row) => {
        const wireTapSerials = (row.wireTAPDevices ?? []).map((d) => d.serialNumber);
        
        return (
          <div className="space-y-1">
            {wireTapSerials.length > 0 ? (
              <div className="flex flex-col gap-1">
                {wireTapSerials.map((serial, i) => (
                  <span key={i} className="text-xs font-mono">
                    {serial}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground text-xs">None</span>
            )}
          </div>
        );
      }
    },
    {
      header: "Screens",
      accessor: "screenCount",
      cell: (row) => (
        <div className="flex items-center">
          <Film className="h-4 w-4 mr-1 text-muted-foreground" />
          <span>{row.screenCount}</span>
        </div>
      )
    },
    {
      header: "Last Updated",
      accessor: "updatedAt",
      exportValue: (row) => (row.updatedAt ? formatDate(row.updatedAt) : null),
      cell: (row) => (
        <div className="flex items-center">
          <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
          <span className="text-sm">
            {formatDate(row.updatedAt)}
          </span>
        </div>
      )
    },
    {
      header: "Updated By",
      accessor: "updatedBy",
      cell: (row) => (
        <div className="flex items-center">
          <User className="h-4 w-4 mr-1 text-muted-foreground" />
          <span className="text-sm">
            {row.updatedBy || "Unknown"}
          </span>
        </div>
      )
    }
  ];
  
  return columns;
};

/** Adds the Status, Listing, Chain and Company filters (options from the server) and makes the other columns sortable. */
export const useEnhancedColumns = (columns: Column<TheatreListRow>[], facets: TheatreFacets | undefined) => {
  return React.useMemo(() => {
    const filters: Record<string, string[]> = {
      Status: ["Active", "Inactive", "Closed"],
      Listing: [...THEATRE_LISTINGS, LISTING_NOT_SET],
      "Chain Name": facets?.chains ?? [],
      Company: facets?.companies ?? [],
    };
    return columns.map((column) =>
      filters[column.header] ? { ...column, filterable: true, filterOptions: filters[column.header] } : { ...column, sortable: true },
    );
  }, [columns, facets]);
};
