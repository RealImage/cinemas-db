import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Download, Plus, LayoutGrid, Table as TableIcon, List, AlertTriangle, Activity, XCircle, Clock, AlertOctagon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DataTable } from "@/components/ui/data-table/data-table";
import { Column, Action } from "@/components/ui/data-table/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatDate, formatDateTime, formatTime } from "@/lib/dateUtils";
import { FilterButton, FilterDrawer, FilterGroup, useFilterDraft } from "@/components/ui/filter-drawer";
import { QueryState } from "@/components/ui/query-state";
import { useFleetImages, useFleetStatus, useImageVersions } from "@/hooks/api/fleet";
import type { FleetNode } from "@/data/fleetData";
import { TheatreNameWithInfo } from "@/components/theatres/TheatreInfo";
import { formatTheatreAddress, theatreAlternateNames } from "@/data/theatreSummary";

const EMPTY_NODES: FleetNode[] = [];

interface VersionData {
  version: string;
  active: number;
  inactive: number;
  unresponsive: number;
  deprecated: boolean;
  isDefault: boolean;
}

// Generate version chart data
const generateVersionChartData = (nodes: FleetNode[], defaultVersion: string): VersionData[] => {
  const versionMap = new Map<string, VersionData>();
  
  nodes.forEach(node => {
    if (!versionMap.has(node.version)) {
      versionMap.set(node.version, {
        version: node.version,
        active: 0,
        inactive: 0,
        unresponsive: 0,
        deprecated: node.deprecated,
        isDefault: node.version === defaultVersion,
      });
    }
    const data = versionMap.get(node.version)!;
    if (node.status === "Active") data.active++;
    else if (node.status === "Inactive") data.inactive++;
    else data.unresponsive++;
  });

  return Array.from(versionMap.values()).sort((a, b) => a.version.localeCompare(b.version));
};

interface FleetFilters {
  locations: string[];
  chain: string;
  theatreName: string;
  theatreId: string;
  statuses: string[];
  versions: string[];
  deprecatedOnly: boolean;
}

const EMPTY_FLEET_FILTERS: FleetFilters = {
  locations: [],
  chain: "",
  theatreName: "",
  theatreId: "",
  statuses: [],
  versions: [],
  deprecatedOnly: false,
};

const chartConfig: ChartConfig = {
  active: { label: "Active", color: "hsl(var(--chart-1))" },
  inactive: { label: "Inactive", color: "hsl(var(--chart-2))" },
  unresponsive: { label: "Unresponsive", color: "hsl(var(--chart-3))" },
};

const FleetStatus = () => {
  const navigate = useNavigate();
  // Global Context State
  const [selectedImage, setSelectedImage] = useState<string>("");
  const imagesQuery = useFleetImages();
  const images = imagesQuery.data ?? [];
  const statusQuery = useFleetStatus(selectedImage);
  const versionsQuery = useImageVersions(selectedImage || undefined);

  // Filter State (applied) + drawer draft
  const [filters, setFilters] = useState<FleetFilters>(EMPTY_FLEET_FILTERS);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [draft, setDraft] = useFilterDraft(filters, isFilterOpen);
  const [locationSearch, setLocationSearch] = useState<string>("");
  const {
    locations: selectedLocations,
    chain: chainFilter,
    theatreName: theatreNameFilter,
    theatreId: theatreIdFilter,
    statuses: statusFilters,
    versions: versionFilters,
    deprecatedOnly,
  } = filters;

  // View State
  const [viewMode, setViewMode] = useState<"visual" | "table" | "list">("table");
  const [activeKPI, setActiveKPI] = useState<string | null>(null);

  // Data
  const fleetData = statusQuery.data ?? EMPTY_NODES;
  const lastRefreshed = new Date(statusQuery.dataUpdatedAt || Date.now());
  const isRefreshing = statusQuery.isFetching;
  const deprecatedVersions = useMemo(
    () => new Set((versionsQuery.data ?? []).filter(v => v.status === "deprecated").map(v => v.version)),
    [versionsQuery.data],
  );

  const filteredData = useMemo(() => {
    let data = [...fleetData];

    // Location filter - matches city, state, or country
    if (selectedLocations.length > 0) {
      data = data.filter(n => 
        selectedLocations.some(loc => 
          n.city === loc || n.state === loc || n.country === loc
        )
      );
    }
    if (chainFilter) data = data.filter(n => n.theatreChain === chainFilter);
    if (theatreNameFilter) data = data.filter(n => n.theatreName.toLowerCase().includes(theatreNameFilter.toLowerCase()));
    if (theatreIdFilter) data = data.filter(n => n.theatreId.toLowerCase().includes(theatreIdFilter.toLowerCase()));
    if (statusFilters.length > 0) data = data.filter(n => statusFilters.includes(n.status));
    if (versionFilters.length > 0) data = data.filter(n => versionFilters.includes(n.version));
    if (deprecatedOnly) data = data.filter(n => n.deprecated);
    
    // KPI filter
    if (activeKPI === "active") data = data.filter(n => n.status === "Active");
    if (activeKPI === "inactive") data = data.filter(n => n.status === "Inactive");
    if (activeKPI === "unresponsive") data = data.filter(n => n.status === "Unresponsive");
    if (activeKPI === "deprecated") data = data.filter(n => n.deprecated);

    return data;
  }, [fleetData, selectedLocations, chainFilter, theatreNameFilter, theatreIdFilter, statusFilters, versionFilters, deprecatedOnly, activeKPI]);

  const selectedImageData = images.find(img => img.id === selectedImage);
  const defaultVersion = selectedImageData?.defaultVersion ?? "";
  const versionChartData = useMemo(() => generateVersionChartData(filteredData, defaultVersion), [filteredData, defaultVersion]);

  // KPIs
  const kpis = useMemo(() => ({
    total: filteredData.length,
    active: filteredData.filter(n => n.status === "Active").length,
    inactive: filteredData.filter(n => n.status === "Inactive").length,
    unresponsive: filteredData.filter(n => n.status === "Unresponsive").length,
    deprecated: filteredData.filter(n => n.deprecated).length,
  }), [filteredData]);

  // Risk spotlight
  const riskSpotlight = useMemo(() => {
    const deprecatedUnresponsive = fleetData.filter(n => n.deprecated && n.status === "Unresponsive").length;
    const risks = [];
    if (deprecatedUnresponsive > 0) {
      risks.push({ message: `${deprecatedUnresponsive} unresponsive nodes on deprecated versions`, type: "critical" });
    }
    const brazilInactive = fleetData.filter(n => n.country === "Brazil" && n.status === "Inactive").length;
    if (brazilInactive > 20) {
      risks.push({ message: `Highest inactive rate detected in Brazil (${brazilInactive} nodes)`, type: "warning" });
    }
    return risks;
  }, [fleetData]);

  // Unique values for filters
  const uniqueValues = useMemo(() => ({
    countries: [...new Set(fleetData.map(n => n.country))],
    states: [...new Set(fleetData.map(n => n.state))],
    cities: [...new Set(fleetData.map(n => n.city))],
    chains: [...new Set(fleetData.map(n => n.theatreChain))],
    versions: [...new Set(fleetData.map(n => n.version))],
  }), [fleetData]);

  // All locations combined for smart search
  const allLocations = useMemo(() => {
    const locs = new Set<string>();
    fleetData.forEach(n => {
      locs.add(n.city);
      locs.add(n.state);
      locs.add(n.country);
    });
    return [...locs].sort();
  }, [fleetData]);

  const filteredLocations = useMemo(() => {
    if (!locationSearch) return allLocations.filter(loc => !draft.locations.includes(loc));
    return allLocations.filter(loc => 
      loc.toLowerCase().includes(locationSearch.toLowerCase()) && !draft.locations.includes(loc)
    );
  }, [allLocations, locationSearch, draft.locations]);

  // Active filters for pill display
  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string; value: string }[] = [];
    
    selectedLocations.forEach(loc => {
      filters.push({ key: `location-${loc}`, label: "Location", value: loc });
    });
    if (chainFilter) {
      filters.push({ key: "chain", label: "Chain", value: chainFilter });
    }
    if (theatreNameFilter) {
      filters.push({ key: "theatreName", label: "Theatre name", value: theatreNameFilter });
    }
    if (theatreIdFilter) {
      filters.push({ key: "theatreId", label: "Theatre ID", value: theatreIdFilter });
    }
    statusFilters.forEach(status => {
      filters.push({ key: `status-${status}`, label: "Agent / OS status", value: status });
    });
    versionFilters.forEach(version => {
      filters.push({ key: `version-${version}`, label: "Version", value: version });
    });
    if (deprecatedOnly) {
      filters.push({ key: "deprecated", label: "Deprecated", value: "Only" });
    }
    
    return filters;
  }, [selectedLocations, chainFilter, theatreNameFilter, theatreIdFilter, statusFilters, versionFilters, deprecatedOnly]);

  const removeFilter = (key: string) => {
    setFilters(prev => {
      if (key.startsWith("location-")) {
        const loc = key.replace("location-", "");
        return { ...prev, locations: prev.locations.filter(l => l !== loc) };
      }
      if (key === "chain") return { ...prev, chain: "" };
      if (key === "theatreName") return { ...prev, theatreName: "" };
      if (key === "theatreId") return { ...prev, theatreId: "" };
      if (key.startsWith("status-")) {
        const status = key.replace("status-", "");
        return { ...prev, statuses: prev.statuses.filter(s => s !== status) };
      }
      if (key.startsWith("version-")) {
        const version = key.replace("version-", "");
        return { ...prev, versions: prev.versions.filter(v => v !== version) };
      }
      if (key === "deprecated") return { ...prev, deprecatedOnly: false };
      return prev;
    });
  };

  const toggleDraftValue = (field: "statuses" | "versions", value: string, checked: boolean) => {
    setDraft(d => ({
      ...d,
      [field]: checked ? [...d[field], value] : d[field].filter(v => v !== value),
    }));
  };

  const handleRefresh = () => {
    statusQuery.refetch();
    versionsQuery.refetch();
  };

  const handleResetFilters = () => {
    setLocationSearch("");
    setFilters(EMPTY_FLEET_FILTERS);
    setDraft(EMPTY_FLEET_FILTERS);
    setActiveKPI(null);
  };

  const handleApplyFilters = () => {
    setLocationSearch("");
    setFilters(draft);
  };

  const toggleKPI = (kpi: string) => {
    setActiveKPI(activeKPI === kpi ? null : kpi);
  };

  // Table columns
  const columns: Column<FleetNode>[] = [
    { accessor: "nodeId", header: "Node ID", sortable: true },
    { accessor: "theatreChain", header: "Theatre Chain", sortable: true },
    { accessor: "theatreName", header: "Theatre Name", sortable: true, cell: (row) => (
      <div>
        <TheatreNameWithInfo
          name={row.theatreName}
          // The row carries the theatre's details, also for appliances whose theatre isn't linked in CinemaDB
          details={{
            name: row.theatreName,
            alternateNames: theatreAlternateNames(row.theatreName, row.displayName, row.alternateNames),
            uuid: row.uuid || null,
            address: formatTheatreAddress({
              address: row.address, city: row.city, state: row.state, postalCode: row.postalCode, country: row.country,
            }),
          }}
        />
        <div className="text-xs text-muted-foreground">{row.city}, {row.state}, {row.country}</div>
      </div>
    )},
    { accessor: "version", header: "Version", sortable: true, cell: (row) => (
      <div className="flex items-center gap-2">
        <span>{row.version}</span>
        {row.deprecated && <Badge variant="destructive" className="text-xs">Deprecated</Badge>}
        {row.version === defaultVersion && <Badge variant="default" className="text-xs bg-green-600">Recommended</Badge>}
      </div>
    )},
    { accessor: "status", header: "Status", sortable: true, cell: (row) => (
      <Badge variant={row.status === "Active" ? "default" : row.status === "Inactive" ? "secondary" : "destructive"}>
        {row.status}
      </Badge>
    )},
    { accessor: "lastHeartbeat", header: "Last Heartbeat", sortable: true, cell: (row) => formatDateTime(row.lastHeartbeat) },
    { accessor: "lastUpdateTask", header: "Last Update Task", sortable: true, cell: (row) => row.lastUpdateTask || "-" },
  ];

  const tableActions: Action<FleetNode>[] = [
    { label: "View Details", onClick: (row) => console.log("View", row) },
    { label: "Create Task", onClick: (row) => console.log("Create task for", row) },
  ];

  return (
    <div className="space-y-4">
      {/* A1. Global Context Bar */}
      <div className="sticky top-0 z-10 bg-background border-b pb-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 max-w-md">
            <Label htmlFor="fleet-image-select" className="text-sm text-muted-foreground mb-1 block">Select OS / Agent / App</Label>
            <Combobox
              id="fleet-image-select"
              value={selectedImage}
              onChange={(v) => { if (v) setSelectedImage(v); }}
              disabled={!imagesQuery.isSuccess}
              options={images.map((img) => ({ value: img.id, label: `${img.agentOsName} (${img.provider})` }))}
              placeholder={imagesQuery.isPending ? "Loading apps…" : imagesQuery.isError ? "Could not load apps" : "Select App ▾"}
              searchPlaceholder="Search apps…"
            />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Last refreshed: {formatTime(lastRefreshed)}
            </span>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing || !selectedImage}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh now
            </Button>
          </div>
        </div>
      </div>

      {selectedImage && (
        <QueryState query={statusQuery} label="fleet status">
          {() => (
        <>
          {/* A2. Applied filter chips + the page's single filter trigger */}
          <div id="fleet-filter-panel" className="sticky top-16 z-10 bg-background border rounded-lg p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 flex items-center gap-2 flex-wrap">
                {activeFilters.length > 0 ? (
                  <>
                    {activeFilters.map(filter => (
                      <Badge 
                        key={filter.key} 
                        variant="secondary" 
                        className="flex items-center gap-1 pl-2 pr-1 py-1"
                      >
                        <span className="text-xs text-muted-foreground">{filter.label}:</span>
                        <span className="text-xs font-medium">{filter.value}</span>
                        <button 
                          onClick={() => removeFilter(filter.key)}
                          className="ml-1 hover:bg-muted rounded p-0.5"
                          aria-label={`Remove ${filter.label} filter`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleResetFilters}
                      className="text-xs text-muted-foreground"
                    >
                      Clear all
                    </Button>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">No filters applied</span>
                )}
              </div>
              <FilterButton count={activeFilters.length} onClick={() => setIsFilterOpen(true)} />
            </div>
          </div>

          <FilterDrawer
            open={isFilterOpen}
            onOpenChange={setIsFilterOpen}
            onApply={handleApplyFilters}
            onClear={handleResetFilters}
          >
            <FilterGroup title="Theatre location">
              <Input 
                placeholder="Search city, state, or country..." 
                aria-label="Search theatre location"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
              />
              {draft.locations.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {draft.locations.map(loc => (
                    <Badge key={loc} variant="secondary" className="flex items-center gap-1">
                      {loc}
                      <button 
                        onClick={() => setDraft(d => ({ ...d, locations: d.locations.filter(l => l !== loc) }))}
                        className="hover:bg-muted rounded p-0.5"
                        aria-label={`Remove ${loc}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {locationSearch && filteredLocations.length > 0 && (
                <div className="border rounded-md max-h-40 overflow-y-auto">
                  {filteredLocations.slice(0, 10).map(loc => (
                    <button
                      key={loc}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                      onClick={() => {
                        setDraft(d => ({ ...d, locations: [...d.locations, loc] }));
                        setLocationSearch("");
                      }}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </FilterGroup>

            <FilterGroup title="Theatre chain">
              <Combobox
                aria-label="Theatre chain"
                value={draft.chain || "all"}
                onChange={(v) => setDraft(d => ({ ...d, chain: !v || v === "all" ? "" : v }))}
                options={[{ value: "all", label: "All chains" }, ...uniqueValues.chains.map((c) => ({ value: c, label: c }))]}
                placeholder="All chains"
                searchPlaceholder="Search chains…"
              />
            </FilterGroup>

            <FilterGroup title="Theatre name">
              <Input 
                placeholder="Search theatre name..." 
                aria-label="Theatre name"
                value={draft.theatreName} 
                onChange={(e) => setDraft(d => ({ ...d, theatreName: e.target.value }))}
              />
            </FilterGroup>

            <FilterGroup title="Theatre ID">
              <Input 
                placeholder="Search theatre ID..." 
                aria-label="Theatre ID"
                value={draft.theatreId} 
                onChange={(e) => setDraft(d => ({ ...d, theatreId: e.target.value }))}
              />
            </FilterGroup>

            <FilterGroup title="Agent / OS status">
              {["Active", "Inactive", "Unresponsive"].map(status => (
                <div key={status} className="flex items-center gap-2">
                  <Checkbox 
                    id={`status-${status}`}
                    checked={draft.statuses.includes(status)}
                    onCheckedChange={(checked) => toggleDraftValue("statuses", status, !!checked)}
                  />
                  <Label htmlFor={`status-${status}`} className="text-sm cursor-pointer">{status}</Label>
                </div>
              ))}
            </FilterGroup>

            <FilterGroup title="Version">
              {uniqueValues.versions.map(version => (
                <div key={version} className="flex items-center gap-2">
                  <Checkbox 
                    id={`version-${version}`}
                    checked={draft.versions.includes(version)}
                    onCheckedChange={(checked) => toggleDraftValue("versions", version, !!checked)}
                  />
                  <Label htmlFor={`version-${version}`} className="text-sm cursor-pointer flex items-center gap-1">
                    {version}
                    {deprecatedVersions.has(version) && (
                      <Badge variant="destructive" className="text-xs">Deprecated</Badge>
                    )}
                  </Label>
                </div>
              ))}
            </FilterGroup>

            <FilterGroup title="Deprecated">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="deprecated-only"
                  checked={draft.deprecatedOnly} 
                  onCheckedChange={(checked) => setDraft(d => ({ ...d, deprecatedOnly: !!checked }))} 
                />
                <Label htmlFor="deprecated-only" className="text-sm cursor-pointer">Deprecated only</Label>
              </div>
            </FilterGroup>
          </FilterDrawer>

          {/* A3. Fleet Summary KPI Strip */}
          <div id="fleet-kpi-strip" className="grid grid-cols-5 gap-4">
            <Card 
              className={`cursor-pointer transition-all ${activeKPI === 'total' ? 'ring-2 ring-primary' : ''}`}
              onClick={() => toggleKPI('total')}
            >
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Nodes in Scope</p>
                    <p className="text-3xl font-bold">{kpis.total}</p>
                  </div>
                  <Activity className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card 
              className={`cursor-pointer transition-all ${activeKPI === 'active' ? 'ring-2 ring-green-500' : ''}`}
              onClick={() => toggleKPI('active')}
            >
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active</p>
                    <p className="text-3xl font-bold text-green-600">{kpis.active}</p>
                  </div>
                  <Activity className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card 
              className={`cursor-pointer transition-all ${activeKPI === 'inactive' ? 'ring-2 ring-yellow-500' : ''}`}
              onClick={() => toggleKPI('inactive')}
            >
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Inactive</p>
                    <p className="text-3xl font-bold text-yellow-600">{kpis.inactive}</p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>
            <Card 
              className={`cursor-pointer transition-all ${activeKPI === 'unresponsive' ? 'ring-2 ring-red-500' : ''}`}
              onClick={() => toggleKPI('unresponsive')}
            >
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Unresponsive</p>
                    <p className="text-3xl font-bold text-red-600">{kpis.unresponsive}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
            <Card 
              className={`cursor-pointer transition-all ${activeKPI === 'deprecated' ? 'ring-2 ring-orange-500' : ''}`}
              onClick={() => toggleKPI('deprecated')}
            >
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Deprecated Versions</p>
                    <p className="text-3xl font-bold text-orange-600">{kpis.deprecated}</p>
                  </div>
                  <AlertOctagon className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* A4. Version × Status Distribution Chart */}
          <Card id="version-status-chart">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Version × Status Distribution</h3>
              <ChartContainer config={chartConfig} className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={versionChartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="version" 
                      tick={({ x, y, payload }) => {
                        const data = versionChartData.find(d => d.version === payload.value);
                        return (
                          <g transform={`translate(${x},${y})`}>
                            <text x={0} y={0} dy={16} textAnchor="middle" fill="currentColor" fontSize={12}>
                              {payload.value}
                            </text>
                            {data?.deprecated && (
                              <text x={0} y={0} dy={30} textAnchor="middle" fill="hsl(var(--destructive))" fontSize={10}>
                                Deprecated
                              </text>
                            )}
                            {data?.isDefault && (
                              <text x={0} y={0} dy={30} textAnchor="middle" fill="hsl(142 76% 36%)" fontSize={10}>
                                ★ Default
                              </text>
                            )}
                          </g>
                        );
                      }}
                    />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar dataKey="active" stackId="a" fill="hsl(142 76% 36%)" name="Active" />
                    <Bar dataKey="inactive" stackId="a" fill="hsl(25 95% 53%)" name="Inactive" />
                    <Bar dataKey="unresponsive" stackId="a" fill="hsl(0 84% 60%)" name="Unresponsive" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* A5. Risk Spotlight Strip (Conditional) */}
          {riskSpotlight.length > 0 && (
            <div id="risk-spotlight" className="space-y-2">
              {riskSpotlight.map((risk, i) => (
                <Card key={i} className={`border-l-4 ${risk.type === 'critical' ? 'border-l-red-500 bg-red-50 dark:bg-red-950/20' : 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'}`}>
                  <CardContent className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className={`h-5 w-5 ${risk.type === 'critical' ? 'text-red-500' : 'text-yellow-500'}`} />
                      <span className="font-medium">{risk.message}</span>
                    </div>
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4 mr-1" />
                      Create Task
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* A6. View Toggle + Action Bar */}
          <div id="view-action-bar" className="flex items-center justify-between py-2">
            <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as typeof viewMode)}>
              <ToggleGroupItem value="visual" aria-label="Visual view">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Table view">
                <TableIcon className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="list" aria-label="List view">
                <List className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button 
                size="sm"
                onClick={() => {
                  const now = new Date();
                  const currentDate = now.toISOString().split('T')[0];
                  const currentTime = now.toTimeString().slice(0, 5);
                  
                  // Map filtered data to appliance format
                  const appliances = filteredData.map((node) => ({
                    id: node.applianceId,
                    applianceSerial: node.applianceSerialNumber,
                    hardwareSerial: node.hardwareSerialNumber,
                    nodeId: node.nodeId,
                    theatreName: node.theatreName,
                    city: node.city,
                    state: node.state,
                    country: node.country,
                    chain: node.theatreChain,
                    cluster: node.clusterName,
                    updateStatus: "Pending" as const,
                  }));
                  
                  navigate("/fleet-management/task/new", {
                    state: {
                      taskData: {
                        taskType: "Agent Update",
                        selectedAgent: selectedImageData?.id || "",
                        agentName: selectedImageData?.agentOsName || "",
                        triggerDate: currentDate,
                        triggerTime: currentTime,
                        triggerTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone.includes("America/Los_Angeles") ? "PST" : 
                                         Intl.DateTimeFormat().resolvedOptions().timeZone.includes("America/New_York") ? "EST" : "PST",
                        description: "",
                        targetVersion: selectedImageData?.defaultVersion || "",
                        agentTargetVersion: selectedImageData?.defaultVersion || "",
                      },
                      appliances,
                    }
                  });
                }}
                disabled={!selectedImage}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Task
              </Button>
            </div>
          </div>

          {/* A7. Data View Area */}
          <div id="fleet-data-view">
            {viewMode === "visual" && (
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">{((kpis.active / kpis.total) * 100).toFixed(1)}%</p>
                      <p className="text-sm text-muted-foreground">Active Rate</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">{uniqueValues.versions.length}</p>
                      <p className="text-sm text-muted-foreground">Versions in Use</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">{filteredData.length}</p>
                      <p className="text-sm text-muted-foreground">Theatres</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-2xl font-bold">{uniqueValues.countries.length}</p>
                      <p className="text-sm text-muted-foreground">Countries</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {viewMode === "table" && (
              <DataTable
                data={filteredData}
                exportName="Fleet Status"
                columns={columns}
                searchable
                searchPlaceholder="Search by Node ID, Theatre..."
                showFilters={false}
                actions={() => tableActions}
              />
            )}

            {viewMode === "list" && (
              <Card>
                <CardContent className="pt-4 divide-y">
                  {filteredData.slice(0, 50).map(node => (
                    <div key={node.id} id="fleet-list" className="py-2 flex items-center gap-4 font-mono text-sm">
                      <span className={`w-3 h-3 rounded-full ${
                        node.status === 'Active' ? 'bg-green-500' : 
                        node.status === 'Inactive' ? 'bg-yellow-500' : 'bg-red-500'
                      }`} />
                      <span className="font-medium w-32">{node.nodeId}</span>
                      <span className="text-muted-foreground w-20">{node.version}</span>
                      <Badge variant={node.status === "Active" ? "default" : node.status === "Inactive" ? "secondary" : "destructive"} className="w-24 justify-center">
                        {node.status}
                      </Badge>
                      <span className="text-muted-foreground flex-1">{node.city}, {node.state}, {node.country}</span>
                      <span className="text-muted-foreground text-xs">{formatDateTime(node.lastHeartbeat)}</span>
                    </div>
                  ))}
                  {filteredData.length > 50 && (
                    <div className="py-4 text-center text-muted-foreground">
                      Showing 50 of {filteredData.length} nodes. Use filters to narrow results.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </>
          )}
        </QueryState>
      )}

      {!selectedImage && imagesQuery.isError && (
        <QueryState query={imagesQuery} label="apps">{() => null}</QueryState>
      )}

      {!selectedImage && !imagesQuery.isError && (
        <Card className="p-12 text-center">
          <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Select an OS / Agent / App</h3>
          <p className="text-muted-foreground">Choose an application from the dropdown above to view fleet status</p>
        </Card>
      )}
    </div>
  );
};

export default FleetStatus;
