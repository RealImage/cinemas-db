
import { useState, useMemo, useCallback } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FilterButton } from "@/components/ui/filter-drawer";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationControls } from "@/components/ui/data-table/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from "recharts";
import { ProjectionFilterPanel, type ProjectionFilters } from "@/components/projection-manager/ProjectionFilterPanel";
import { projectionScoreBins, type QualityStatus, type ProjectionScreenRecord } from "@/data/projectionManagerData";
import { QueryState } from "@/components/ui/query-state";
import { useProjectionScreens } from "@/hooks/api/screenPulse";
import { TheatreNameWithInfo } from "@/components/theatres/TheatreInfo";

const defaultFilters: ProjectionFilters = {
  chain: "all",
  location: "all",
  scoreRange: "all",
  projectionQuality: "all",
  soundQuality: "all",
};

const QualityCell = ({ value, status }: { value: string; status: QualityStatus }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <div className="flex items-center gap-1.5 cursor-default">
        {status === "within_limits" ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
        ) : (
          <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
        )}
        <span className="text-sm">{value}</span>
      </div>
    </TooltipTrigger>
    <TooltipContent side="top" className="text-xs">
      {status === "within_limits" ? "Within Recommended Limits" : "Outside Recommended Limits"}
    </TooltipContent>
  </Tooltip>
);

const chartConfig = { count: { label: "Screens", color: "hsl(var(--primary))" } };

const ProjectionManager = () => {
  const screensQuery = useProjectionScreens();
  return (
    <QueryState query={screensQuery} label="projection ratings">
      {(data) => <ProjectionManagerContent data={data} />}
    </QueryState>
  );
};

const ProjectionManagerContent = ({ data }: { data: ProjectionScreenRecord[] }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<ProjectionFilters>(defaultFilters);
  const [selectedBar, setSelectedBar] = useState<string | null>(null);

  const chains = useMemo(() => [...new Set(data.map((s) => s.chainName))].sort(), [data]);
  const locationOptions = useMemo(() => [...new Set(data.map((s) => `${s.city}, ${s.state}, ${s.country}`))].sort(), [data]);

  const histogramData = useMemo(
    () => projectionScoreBins.map((bin) => ({
      range: bin.label,
      count: data.filter((s) => s.score >= bin.min && s.score <= bin.max).length,
      min: bin.min,
      max: bin.max,
    })),
    [data]
  );

  const filteredData = useMemo(() => {
    let result = [...data];

    if (selectedBar) {
      const bin = projectionScoreBins.find((b) => b.label === selectedBar);
      if (bin) result = result.filter((s) => s.score >= bin.min && s.score <= bin.max);
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.theatreName.toLowerCase().includes(lower) ||
          s.chainName.toLowerCase().includes(lower) ||
          s.city.toLowerCase().includes(lower) ||
          s.state.toLowerCase().includes(lower) ||
          s.country.toLowerCase().includes(lower)
      );
    }

    if (filters.chain !== "all") result = result.filter((s) => s.chainName === filters.chain);
    if (filters.location !== "all") result = result.filter((s) => `${s.city}, ${s.state}, ${s.country}` === filters.location);
    if (filters.scoreRange !== "all") result = result.filter((s) => s.scoreCategory === filters.scoreRange);
    if (filters.projectionQuality !== "all") result = result.filter((s) => s.projectionQuality.status === filters.projectionQuality);
    if (filters.soundQuality !== "all") result = result.filter((s) => s.soundQuality.status === filters.soundQuality);

    return result;
  }, [data, searchTerm, filters, selectedBar]);

  const resetKey = useMemo(() => [searchTerm, filters, selectedBar], [searchTerm, filters, selectedBar]);
  const { page: currentPage, setPage: setCurrentPage, pageSize, setPageSize, totalPages, totalItems, pageItems: paginatedData } =
    usePagination(filteredData, resetKey);
  const activeFilterCount = Object.values(filters).filter((v) => v !== "all").length + (selectedBar ? 1 : 0);

  const handleApplyFilters = (next: ProjectionFilters) => {
    setFilters(next);
  };

  const handleBarClick = useCallback((data: { activePayload?: { payload?: { range?: string } }[] } | null) => {
    if (data?.activePayload) {
      const clickedRange = data.activePayload[0]?.payload?.range ?? null;
      setSelectedBar((prev) => (prev === clickedRange ? null : clickedRange));
    }
  }, []);

  const clearAll = () => {
    setFilters(defaultFilters);
    setSelectedBar(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <p className="text-muted-foreground">Projection score distribution and screen-level quality ratings</p>

      {/* Histogram */}
      <DashboardCard
        title="Projection Score Distribution"
        description={selectedBar ? `Filtered to: ${selectedBar} — click again to clear` : "Click a bar to filter the table below"}
      >
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={histogramData} margin={{ top: 10, right: 20, bottom: 40, left: 20 }} onClick={handleBarClick}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="range"
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
              label={{ value: "Score Range", position: "insideBottom", offset: -20, className: "fill-muted-foreground text-xs" }}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              className="fill-muted-foreground"
              label={{ value: "Screens", angle: -90, position: "insideLeft", offset: -5, className: "fill-muted-foreground text-xs" }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} className="cursor-pointer">
              {histogramData.map((entry) => (
                <Cell
                  key={entry.range}
                  fill={selectedBar === entry.range ? "hsl(var(--primary))" : selectedBar ? "hsl(var(--muted-foreground) / 0.3)" : "hsl(var(--primary))"}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </DashboardCard>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Within Recommended Limits</div>
        <div className="flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 text-destructive" /> Outside Recommended Limits</div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search theatre name, chain, or location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
        {selectedBar && (
          <Badge variant="secondary" className="flex items-center gap-1">
            Score: {selectedBar}
            <button
              type="button"
              aria-label="Remove score filter"
              className="hover:text-destructive"
              onClick={() => setSelectedBar(null)}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
        <span className="text-sm text-muted-foreground ml-auto">
          {filteredData.length} screen{filteredData.length !== 1 ? "s" : ""}
        </span>
        <FilterButton count={activeFilterCount} onClick={() => setFiltersOpen(true)} />
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Score</TableHead>
                <TableHead>Screen</TableHead>
                <TableHead>Theatre Name</TableHead>
                <TableHead>Chain Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Projection Quality</TableHead>
                <TableHead>Sound Quality</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No screens match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((screen) => (
                  <TableRow key={screen.id}>
                    <TableCell className="font-bold text-center">{screen.score}</TableCell>
                    <TableCell className="font-medium">{screen.screenName}</TableCell>
                    <TableCell><TheatreNameWithInfo name={screen.theatreName} theatreRef={screen.theatreId} nameClassName="" /></TableCell>
                    <TableCell>{screen.chainName}</TableCell>
                    <TableCell className="text-muted-foreground">{screen.city}, {screen.state}, {screen.country}</TableCell>
                    <TableCell><QualityCell value={screen.projectionQuality.value} status={screen.projectionQuality.status} /></TableCell>
                    <TableCell><QualityCell value={screen.soundQuality.value} status={screen.soundQuality.status} /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        rowsPerPage={pageSize}
        handlePageChange={setCurrentPage}
        handleRowsPerPageChange={setPageSize}
      />

      {/* Filter Panel */}
      <ProjectionFilterPanel
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        chains={chains}
        locations={locationOptions}
        filters={filters}
        defaultFilters={defaultFilters}
        onApply={handleApplyFilters}
        onClear={clearAll}
      />
    </div>
  );
};

export default ProjectionManager;
