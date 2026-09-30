import { useMemo } from "react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { Monitor, Eye, EyeOff, Thermometer, Projector, Building2 } from "lucide-react";
import { DataTable, Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { QueryState } from "@/components/ui/query-state";
import { usePulseDashboard } from "@/hooks/api/screenPulse";
import type { PulseDashboardData, PulseMonitoredTheatre } from "@/types/screenPulse";
import { TheatreNameWithInfo } from "@/components/theatres/TheatreInfo";

type Coverage = "All screens" | "Some screens" | "No screens";

interface MonitoredTheatre extends PulseMonitoredTheatre {
  environmentCoverage: Coverage;
  projectionCoverage: Coverage;
}

const coverageOf = (monitored: number, screens: number): Coverage =>
  monitored === 0 ? "No screens" : monitored >= screens ? "All screens" : "Some screens";

const coverageOptions: Coverage[] = ["All screens", "Some screens", "No screens"];

/** Distinct values of a field, for a column's filter options. */
const optionsFor = (key: "city" | "country") => (rows: MonitoredTheatre[]) =>
  Array.from(new Set(rows.map((r) => r[key]))).sort((a, b) => a.localeCompare(b));

const theatreColumns: Column<MonitoredTheatre>[] = [
  { header: "Theatre", accessor: "name", sortable: true, cell: (t) => <TheatreNameWithInfo name={t.name} theatreRef={t.id} /> },
  { header: "City", accessor: "city", sortable: true, filterable: true, filterOptions: optionsFor("city") },
  { header: "Country", accessor: "country", sortable: true, filterable: true, filterOptions: optionsFor("country") },
  {
    header: "Screens",
    accessor: "screens",
    sortable: true,
    cell: (t) => <Badge variant="secondary">{t.screens}</Badge>,
  },
  {
    // Filter on coverage; the cell still shows the monitored screen count.
    header: "Environment",
    accessor: "environmentCoverage",
    filterable: true,
    filterOptions: coverageOptions,
    exportValue: (t) => t.environment,
    cell: (t) => (
      <Badge variant="outline" className="border-primary/50 text-primary" title={t.environmentCoverage}>
        {t.environment}
      </Badge>
    ),
  },
  {
    header: "Projection",
    accessor: "projectionCoverage",
    filterable: true,
    filterOptions: coverageOptions,
    exportValue: (t) => t.projection,
    cell: (t) => (
      <Badge variant="outline" className="border-accent-foreground/30 text-accent-foreground" title={t.projectionCoverage}>
        {t.projection}
      </Badge>
    ),
  },
];

const envChartConfig = {
  count: { label: "Screens", color: "hsl(var(--primary))" },
};

const projChartConfig = {
  count: { label: "Screens", color: "hsl(210 80% 60%)" },
};

export default function PulseDashboard() {
  const dashboardQuery = usePulseDashboard();
  return (
    <QueryState query={dashboardQuery} label="Screen Pulse dashboard">
      {(data) => <DashboardContent data={data} />}
    </QueryState>
  );
}

function DashboardContent({ data }: { data: PulseDashboardData }) {
  const monitoredTheatres: MonitoredTheatre[] = useMemo(
    () =>
      data.theatres.map((t) => ({
        ...t,
        environmentCoverage: coverageOf(t.environment, t.screens),
        projectionCoverage: coverageOf(t.projection, t.screens),
      })),
    [data.theatres],
  );
  const totalScreens = monitoredTheatres.reduce((sum, t) => sum + t.screens, 0);
  const envMonitored = monitoredTheatres.reduce((sum, t) => sum + t.environment, 0);
  const projMonitored = monitoredTheatres.reduce((sum, t) => sum + t.projection, 0);
  const noMonitoring = totalScreens - Math.max(envMonitored, projMonitored);
  const envHistogramData = data.environmentHistogram;
  const projHistogramData = data.projectionHistogram;

  return (
    <div className="flex flex-col gap-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Theatres Monitored"
          value={monitoredTheatres.length}
          icon={<Building2 className="h-5 w-5" />}
        />
        <StatCard
          title="Screens Monitored"
          value={totalScreens}
          icon={<Monitor className="h-5 w-5" />}
        />
        <StatCard
          title="Environment Monitoring"
          value={envMonitored}
          icon={<Thermometer className="h-5 w-5" />}
        />
        <StatCard
          title="Projection Monitoring"
          value={projMonitored}
          icon={<Projector className="h-5 w-5" />}
        />
        <StatCard
          title="No Monitoring"
          value={noMonitoring}
          icon={<EyeOff className="h-5 w-5" />}
        />
      </div>

      {/* Theatres Table */}
      <DashboardCard title="Monitored Theatres">
        <DataTable data={monitoredTheatres} columns={theatreColumns} searchPlaceholder="Search theatres..." exportName="Pulse Theatres" />
      </DashboardCard>

      {/* Environment Monitoring Histogram */}
      <DashboardCard title="Environment Monitoring Distribution" description="Number of screens by environment monitoring score range">
        <ChartContainer config={envChartConfig} className="h-[300px] w-full">
          <BarChart data={envHistogramData} margin={{ top: 10, right: 20, bottom: 40, left: 20 }}>
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
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </DashboardCard>

      {/* Projection Monitoring Histogram */}
      <DashboardCard title="Projection Monitoring Distribution" description="Number of screens by projection monitoring score range">
        <ChartContainer config={projChartConfig} className="h-[300px] w-full">
          <BarChart data={projHistogramData} margin={{ top: 10, right: 20, bottom: 40, left: 20 }}>
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
            <Bar dataKey="count" fill="hsl(210 80% 60%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </DashboardCard>
    </div>
  );
}
