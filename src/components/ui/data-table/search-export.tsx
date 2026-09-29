
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Download, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ExportFormat } from "@/lib/export";

interface SearchExportProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  searchPlaceholder: string;
  onExport: (format: ExportFormat) => void;
  /** An export is being built: the button shows a spinner and can't start another. */
  exporting?: boolean;
  children?: React.ReactNode;
}

export function SearchExport({
  searchTerm,
  setSearchTerm,
  searchPlaceholder,
  onExport,
  exporting = false,
  children
}: SearchExportProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-8"
        />
      </div>

      {children}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={exporting} aria-busy={exporting || undefined}>
            Export
            {exporting
              ? <Loader2 className="ml-2 h-4 w-4 animate-spin" aria-hidden />
              : <Download className="ml-2 h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Export Options</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onExport("csv")}>CSV</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onExport("xlsx")}>Excel</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
