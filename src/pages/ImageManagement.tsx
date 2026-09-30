import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DataTable } from "@/components/ui/data-table/data-table";
import { Column, SortConfig, Filter, Action } from "@/components/ui/data-table/types";
import { Plus, Settings, FileText, SlidersHorizontal, Star, StarOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AddVersionDialog } from "@/components/fleet/AddVersionDialog";
import { ViewImageLogsDialog } from "@/components/fleet/ViewImageLogsDialog";
import { formatDate } from "@/lib/dateUtils";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { QueryState } from "@/components/ui/query-state";
import { useAddImageVersion, useFleetImages, useSetDefaultInstall, type AddVersionInput } from "@/hooks/api/fleet";
import type { ImageItem } from "@/data/fleetData";
import { agentConfigurationsPath, isAgentImage } from "@/data/agentConfigData";
export type { ImageItem } from "@/data/fleetData";

const ImageManagement = () => {
  const navigate = useNavigate();
  const imagesQuery = useFleetImages();
  const setDefaultInstall = useSetDefaultInstall();
  const addVersion = useAddImageVersion();
  
  // Dialog states
  const [addVersionOpen, setAddVersionOpen] = useState(false);
  const [viewLogsOpen, setViewLogsOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  // Sort state
  const [sortConfig, setSortConfig] = useState<SortConfig<ImageItem>>({ key: null, direction: null });

  // Filter state
  const [filters, setFilters] = useState<Filter<ImageItem>[]>([]);

  const columns: Column<ImageItem>[] = [
    {
      accessor: "provider",
      header: "Provider",
      sortable: true,
      filterable: true,
      filterOptions: ["Appliance OS", "iCount", "Qlog", "Qube Wire", "Scheduler", "Slate"],
    },
    {
      accessor: "agentOsName",
      header: "Agent / OS Name",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <span>{row.agentOsName}</span>
          {row.defaultInstall && (
            <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 bg-amber-50 gap-1">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              Default Install
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessor: "latestVersion",
      header: "Latest Version",
      sortable: true,
    },
    {
      accessor: "updatedOn",
      header: "Updated On",
      sortable: true,
      cell: (row) => formatDate(row.updatedOn),
    },
    {
      accessor: "updatedBy",
      header: "Updated By",
      sortable: true,
    },
  ];

  const handleToggleDefaultInstall = (image: ImageItem) => {
    setDefaultInstall.mutate(
      { id: image.id, defaultInstall: !image.defaultInstall },
      {
        onSuccess: () =>
          toast.success(
            image.defaultInstall
              ? `"${image.agentOsName}" unmarked as Default Install on New WireTAP.`
              : `"${image.agentOsName}" marked as Default Install on New WireTAP.`,
          ),
        onError: (err) => toast.error(`Could not update "${image.agentOsName}": ${err.message}`),
      },
    );
  };

  const getActionsForImage = (image: ImageItem): Action<ImageItem>[] => {
    return [
      {
        label: image.defaultInstall ? "Unmark as Default Install" : "Mark as Default Install",
        icon: image.defaultInstall ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />,
        onClick: (row) => handleToggleDefaultInstall(row),
      },
      {
        label: "Add Version",
        icon: <Plus className="h-4 w-4" />,
        onClick: (row) => {
          setSelectedImage(row);
          setAddVersionOpen(true);
        },
      },
      {
        label: "Manage Versions",
        icon: <Settings className="h-4 w-4" />,
        onClick: (row) => {
          navigate(`/fleet-management/images/${row.id}/versions`);
        },
      },
      // Appliance OS images are operating systems, not agents
      ...(isAgentImage(image)
        ? [{
            label: "Manage Agent Configurations",
            icon: <SlidersHorizontal className="h-4 w-4" />,
            onClick: (row: ImageItem) => navigate(agentConfigurationsPath(row.id)),
          }]
        : []),
      {
        label: "View Logs",
        icon: <FileText className="h-4 w-4" />,
        onClick: (row) => {
          setSelectedImage(row);
          setViewLogsOpen(true);
        },
      },
    ];
  };

  // Server-side style paging over the list fetched from the API
  const { images, totalCount } = useMemo(() => {
    let filteredData = [...(imagesQuery.data ?? [])];

    // Apply search - only on Agent / OS Name as per requirements
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filteredData = filteredData.filter(
        (image) => image.agentOsName.toLowerCase().includes(search)
      );
    }

    // Apply filters
    filters.forEach((filter) => {
      const values = filter.value;
      if (values && (Array.isArray(values) ? values.length > 0 : values)) {
        filteredData = filteredData.filter((image) => {
          const imageValue = String(image[filter.column as keyof ImageItem]);
          if (Array.isArray(values)) {
            return values.includes(imageValue);
          }
          return imageValue === values;
        });
      }
    });

    // Apply sorting
    if (sortConfig.key && sortConfig.direction) {
      filteredData.sort((a, b) => {
        const aVal = a[sortConfig.key as keyof ImageItem];
        const bVal = b[sortConfig.key as keyof ImageItem];
        
        if (aVal === undefined || bVal === undefined) return 0;
        
        const comparison = String(aVal).localeCompare(String(bVal));
        return sortConfig.direction === "asc" ? comparison : -comparison;
      });
    }

    // Apply pagination
    const start = (currentPage - 1) * pageSize;
    return { images: filteredData.slice(start, start + pageSize), totalCount: filteredData.length };
  }, [imagesQuery.data, currentPage, pageSize, searchTerm, sortConfig, filters]);

  const handlePaginationChange = (page: number, size: number) => {
    setCurrentPage(page);
    setPageSize(size);
  };

  const handleSearchChange = (search: string) => {
    setSearchTerm(search);
    setCurrentPage(1);
  };

  const handleSortChange = (sortKey: keyof ImageItem | null, direction: 'asc' | 'desc' | null) => {
    setSortConfig({ key: sortKey, direction });
  };

  const handleFilterChange = (newFilters: Filter<ImageItem>[]) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const handleAddVersion = (versionData: AddVersionInput) => addVersion.mutateAsync(versionData);

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        Manage agent and OS images and versions
      </p>

      <QueryState query={imagesQuery} label="images">
        {() => (
      <DataTable
        data={images}
        exportName="Images"
        columns={columns}
        searchable
        searchPlaceholder="Search by Agent / OS Name..."
        actions={getActionsForImage}
        serverSide
        totalCount={totalCount}
        pageSize={pageSize}
        onPaginationChange={handlePaginationChange}
        onSearchChange={handleSearchChange}
        onSortChange={handleSortChange}
        onFilterChange={handleFilterChange}
      />
        )}
      </QueryState>

      <AddVersionDialog
        open={addVersionOpen}
        onOpenChange={setAddVersionOpen}
        image={selectedImage}
        onSubmit={handleAddVersion}
      />

      <ViewImageLogsDialog
        open={viewLogsOpen}
        onOpenChange={setViewLogsOpen}
        image={selectedImage}
      />
    </div>
  );
};

export default ImageManagement;
