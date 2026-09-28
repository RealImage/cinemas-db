
import { useState, useMemo, useCallback } from "react";
import { CheckCircle2, AlertTriangle, XCircle, X } from "lucide-react";
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
import { EnvironmentFilterPanel, type EnvironmentFilters } from "@/components/environment-manager/EnvironmentFilterPanel";
import { ScreenDetailDialog } from "@/components/environment-manager/ScreenDetailDialog";
import { scoreRangeBins, type EnvironmentMetric, type RatingStatus, type EnvironmentScreenRecord } from "@/data/environmentManagerData";
import { QueryState } from "@/components/ui/query-state";
import { useEnvironmentScreens } from "@/hooks/api/screenPulse";
import { TheatreNameWithInfo } from "@/components/theatres/TheatreInfo";

const defaultFilters: EnvironmentFilters = {
  chain: "all",
  scoreRange: "all",
  onTemperature: "all",
  onHumidity: "all",
  onDust: "all",
  offTemperature: "all",
  offHumidity: "all",
  offDust: "all",
};

const statusTooltip = (status: RatingStatus) => {
  switch (status) {
    case "within_theatre_baseline": return "Within Theatre Baseline";
    case "within_recommended_baseline": return "Within Recommended Baseline";
    case "out_of_range": return "Out of Range";
  }
};

const StatusIcon = ({ status }: { status: RatingStatus }) => {
  switch (status) {
    case "within_theatre_baseline":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />;
    case "within_recommended_baseline":
      return <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 shrink-0" />;
    case "out_of_range":
      return <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
  }
};

const MetricCell = ({ metric }: { metric: EnvironmentMetric }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <div className="flex items-center gap-1.5 cursor-default">
        <StatusIcon status={metric.status} />
        <span className="text-sm tabular-nums">{metric.value}{metric.unit}</span>
      </div>
    </TooltipTrigger>
    <TooltipContent side="top" className="text-xs">
      {statusTooltip(metric.status)}
    </TooltipContent>
  </Tooltip>
);

const chartConfig = {
  count: { label: "Screens", color: "hsl(var(--primary))" },
};

const EnvironmentManager = () => {
  const screensQuery = useEnvironmentScreens();
  return (
    <QueryState query={screensQuery} label="environment ratings">
      {(data) => <EnvironmentManagerContent data={data} />}
    </QueryState>
  );
};

const EnvironmentManagerContent = ({ data }: { data: EnvironmentScreenRecord[] }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<EnvironmentFilters>(defaultFilters);
  const [selectedBar, setSelectedBar] = useState<string | null>(null);
  const [selectedScreen, setSelectedScreen] = useState<EnvironmentScreenRecord | null>(null);

  const chains = useMemo(() => [...new Set(data.map((s) => s.chainName))].sort(), [data]);

  const histogramData = useMemo(() => {
    return scoreRangeBins.map((bin) => ({
      range: bin.label,
      count: data.filter((s) => s.score >= bin.min && s.score <= bin.max).length,
      min: bin.min,
      max: bin.max,
    }));
  }, [data]);

  const filteredData = useMemo(() => {
    let result = [...data];

    if (selectedBar) {
      const bin = scoreRangeBins.find((b) => b.label === selectedBar);
      if (bin) result = result.filter((s) => s.score >= bin.min && s.score <= bin.max);
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.theatreName.toLowerCase().includes(lower) ||
          s.city.toLowerCase().includes(lower) ||
          s.state.toLowerCase().includes(lower) ||
          s.country.toLowerCase().includes(lower)
      );
    }

    if (filters.chain !== "all") result = result.filter((s) => s.chainName === filters.chain);
    if (filters.scoreRange !== "all") {
      const bin = scoreRangeBins.find((b) => b.label === filters.scoreRange);
      if (bin) result = result.filter((s) => s.score >= bin.min && s.score <= bin.max);
    }
    if (filters.onTemperature !== "all") result = result.filter((s) => s.onTemperature.status === filters.onTemperature);
    if (filters.onHumidity !== "all") result = result.filter((s) => s.onHumidity.status === filters.onHumidity);
    if (filters.onDust !== "all") result = result.filter((s) => s.onDust.status === filters.onDust);
    if (filters.offTemperature !== "all") result = result.filter((s) => s.offTemperature.status === filters.offTemperature);
    if (filters.offHumidity !== "all") result = result.filter((s) => s.offHumidity.status === filters.offHumidity);
    if (filters.offDust !== "all") result = result.filter((s) => s.offDust.status === filters.offDust);

    return result;
  }, [data, searchTerm, filters, selectedBar]);

  const resetKey = useMemo(() => [searchTerm, filters, selectedBar], [searchTerm, filters, selectedBar]);
  const { page: currentPage, setPage: setCurrentPage, pageSize, setPageSize, totalPages, totalItems, pageItems: paginatedData } =
    usePagination(filteredData, resetKey);

  const activeFilterCount = Object.values(filters).filter((v) => v !== "all").length + (selectedBar ? 1 : 0);

  const handleApplyFilters = (next: EnvironmentFilters) => {
    setFilters(next);
  };

  const handleBarClick = useCallback((data: { activePayload?: { payload?: { range?: string } }[] } | null) => {
    if (data && data.activePayload) {
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
      <p className="text-muted-foreground">Environment score distribution and screen-level ratings</p>

      {/* Histogram */}
      <DashboardCard
        title="Environment Score Distribution"
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
        <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Within Theatre Baseline</div>
        <div className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-yellow-600" /> Within Recommended Baseline</div>
        <div className="flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 text-destructive" /> Out of Range</div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search theatre name or location..."
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
                <TableHead>Theatre</TableHead>
                <TableHead>Chain</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-center" colSpan={3}>
                  <span className="text-xs uppercase tracking-wider">ON Ratings</span>
                </TableHead>
                <TableHead className="text-center" colSpan={3}>
                  <span className="text-xs uppercase tracking-wider">OFF Ratings</span>
                </TableHead>
              </TableRow>
              <TableRow>
                <TableHead />
                <TableHead />
                <TableHead />
                <TableHead />
                <TableHead />
                <TableHead className="text-xs">Temp</TableHead>
                <TableHead className="text-xs">Humidity</TableHead>
                <TableHead className="text-xs">Dust</TableHead>
                <TableHead className="text-xs">Temp</TableHead>
                <TableHead className="text-xs">Humidity</TableHead>
                <TableHead className="text-xs">Dust</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    No screens match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((screen) => (
                  <TableRow key={screen.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedScreen(screen)}>
                    <TableCell className="font-bold text-center">{screen.score}</TableCell>
                    <TableCell className="font-medium">{screen.screenName}</TableCell>
                    <TableCell><TheatreNameWithInfo name={screen.theatreName} theatreRef={screen.theatreId} nameClassName="" /></TableCell>
                    <TableCell>{screen.chainName}</TableCell>
                    <TableCell className="text-muted-foreground">{screen.city}, {screen.state}, {screen.country}</TableCell>
                    <TableCell><MetricCell metric={screen.onTemperature} /></TableCell>
                    <TableCell><MetricCell metric={screen.onHumidity} /></TableCell>
                    <TableCell><MetricCell metric={screen.onDust} /></TableCell>
                    <TableCell><MetricCell metric={screen.offTemperature} /></TableCell>
                    <TableCell><MetricCell metric={screen.offHumidity} /></TableCell>
                    <TableCell><MetricCell metric={screen.offDust} /></TableCell>
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
      <EnvironmentFilterPanel
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        chains={chains}
        filters={filters}
        defaultFilters={defaultFilters}
        onApply={handleApplyFilters}
        onClear={clearAll}
      />

      <ScreenDetailDialog
        screen={selectedScreen}
        open={!!selectedScreen}
        onOpenChange={(open) => { if (!open) setSelectedScreen(null); }}
      />
    </div>
  );
};

export default EnvironmentManager;
