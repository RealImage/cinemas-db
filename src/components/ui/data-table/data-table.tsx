
import { useState, useEffect, useMemo, useRef } from "react";
import { Table } from "@/components/ui/table";
import { DataTableHeader } from "./table-header";
import { DataTableBody } from "./table-body";
import { SearchExport } from "./search-export";
import { Filters } from "./filters";
import { PaginationControls } from "./pagination";
import { DataTableProps, Action, Filter, SortDirection, SortConfig } from "./types";
import debounce from 'lodash/debounce';
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

export function DataTable<T extends { id: string }>({
  data,
  columns,
  searchable = true,
  searchPlaceholder = "Search...",
  onRowClick,
  actions,
  pageSize = DEFAULT_PAGE_SIZE,
  serverSide = false,
  totalCount,
  onPaginationChange,
  onSearchChange,
  onSortChange,
  onFilterChange,
  showFilters = true,
  toolbar,
  subToolbar,
  pageResetKey,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>({ key: null, direction: null });
  const [activeFilters, setActiveFilters] = useState<Filter<T>[]>([]);
  
  // Keep the latest onSearchChange without recreating the debounced function
  const onSearchChangeRef = useRef<typeof onSearchChange>(onSearchChange);
  useEffect(() => {
    onSearchChangeRef.current = onSearchChange;
  }, [onSearchChange]);

  // Debounce search changes to minimize unnecessary filtering operations
  const debouncedSearch = useMemo(
    () =>
      debounce((term: string) => {
        onSearchChangeRef.current?.(term);
        // Reset to first page when searching
        setCurrentPage(1);
      }, 300),
    []
  );

  // Cleanup any pending debounced calls on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  // Handle search changes
  useEffect(() => {
    if (serverSide) {
      debouncedSearch(searchTerm);
    } else {
      // Reset to first page when search term changes for client-side filtering
      setCurrentPage(1);
    }
  }, [searchTerm, serverSide, debouncedSearch]);

  // The page's own filters changed: its data restarts at page 1, so the pager should too
  useEffect(() => {
    setCurrentPage(1);
  }, [pageResetKey]);

  // Filtering function for client-side filtering
  const filteredData = useMemo(() => {
    if (serverSide) return data; // Server handles filtering
    
    let filtered = [...data];
    
    // Apply text search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      // Match text and numbers, including inside arrays (e.g. roles, alternate names)
      const matches = (value: unknown): boolean =>
        typeof value === "string" || typeof value === "number"
          ? String(value).toLowerCase().includes(term)
          : Array.isArray(value) && value.some(matches);
      filtered = filtered.filter((item) => Object.values(item).some(matches));
    }
    
    // Apply active filters
    if (activeFilters.length > 0) {
      filtered = filtered.filter(item => {
        return activeFilters.every(filter => {
          const columnValue = item[filter.column];
          
          // Handle date range filtering
          if (typeof filter.value === 'object' && !Array.isArray(filter.value)) {
            const dateRange = filter.value as { from?: Date; to?: Date };
            const itemDate = new Date(columnValue as string);
            
            if (dateRange.from && dateRange.to) {
              return itemDate >= dateRange.from && itemDate <= dateRange.to;
            } else if (dateRange.from) {
              return itemDate >= dateRange.from;
            } else if (dateRange.to) {
              return itemDate <= dateRange.to;
            }
            return true;
          }
          
          if (Array.isArray(filter.value)) {
            if (Array.isArray(columnValue)) {
              return filter.value.some(v => columnValue.includes(v));
            } else {
              return filter.value.includes(String(columnValue));
            }
          } else {
            return String(columnValue) === filter.value;
          }
        });
      });
    }
    
    // Apply sorting if configured
    if (sortConfig.key && sortConfig.direction) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof T];
        const bValue = b[sortConfig.key as keyof T];
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return filtered;
  }, [data, searchTerm, sortConfig, activeFilters, serverSide]);
  
  // Calculate pagination values
  const totalItems = serverSide ? totalCount || 0 : filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));

  // Pages that search/filter themselves pass a new `data` list: go back to
  // page 1 when its size changes, and never sit past the last page.
  useEffect(() => {
    if (!serverSide) setCurrentPage(1);
  }, [data.length, serverSide]);
  useEffect(() => {
    if (!serverSide && currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages, serverSide]);

  const paginatedData = useMemo(() => {
    if (serverSide) return data;
    const page = Math.min(currentPage, totalPages);
    return filteredData.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  }, [filteredData, currentPage, totalPages, rowsPerPage, serverSide, data]);
  
  // Handle page change
  const handlePageChange = (newPage: number) => {
    // Prevent a pending debounced search from snapping back to page 1
    if (serverSide) {
      debouncedSearch.cancel();
    }

    const validatedPage = Math.max(1, Math.min(newPage, totalPages));
    setCurrentPage(validatedPage);
    
    if (serverSide && onPaginationChange) {
      onPaginationChange(validatedPage, rowsPerPage);
    }
  };

  // Handle rows per page change
  const handleRowsPerPageChange = (newPageSize: number) => {
    if (serverSide) {
      debouncedSearch.cancel();
    }

    setRowsPerPage(newPageSize);
    setCurrentPage(1); // Reset to first page
    
    if (serverSide && onPaginationChange) {
      onPaginationChange(1, newPageSize);
    }
  };
  
  // Handle sort change
  const handleSort = (column: typeof columns[0]) => {
    if (!column.sortable) return;
    
    const accessor = column.accessor as keyof T;
    let direction: SortDirection = 'asc';
    
    if (sortConfig.key === accessor) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc';
      } else if (sortConfig.direction === 'desc') {
        direction = null;
      }
    }
    
    const newSortConfig: SortConfig<T> = {
      key: direction ? accessor : null,
      direction
    };
    
    setSortConfig(newSortConfig);
    
    if (serverSide && onSortChange) {
      onSortChange(newSortConfig.key, newSortConfig.direction);
    }
  };
  
  // Commit a full set of filters (FilterDrawer Apply / Clear all)
  const applyFilters = (newFilters: Filter<T>[]) => {
    setActiveFilters(newFilters);
    if (serverSide && onFilterChange) {
      onFilterChange(newFilters);
    }
    setCurrentPage(1);
  };

  // Get row actions
  const getRowActions = (row: T) => {
    if (!actions) return [];
    return typeof actions === 'function' ? actions(row) : actions;
  };
  
  // Generate filter options for a column
  const getFilterOptions = (column: typeof columns[0], columnKey: keyof T) => {
    // No explicit options: offer the column's distinct values
    if (!column.filterOptions) {
      const values = new Set<string>();
      data.forEach((row) => {
        const v = row[columnKey];
        if (v !== null && v !== undefined && v !== "") values.add(String(v));
      });
      return Array.from(values).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }

    if (typeof column.filterOptions === 'function') {
      return column.filterOptions(data);
    }
    
    return column.filterOptions;
  };
  
  // Show actions column flag
  const showActions = Boolean(actions && actions.length > 0);
  
  return (
    <div className="w-full space-y-4 animate-fade-in">
      {searchable && (
        <SearchExport
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          searchPlaceholder={searchPlaceholder}
        >
          {showFilters && columns.some((c) => c.filterable) && (
            <Filters
              columns={columns}
              activeFilters={activeFilters}
              applyFilters={applyFilters}
              getFilterOptions={getFilterOptions}
            />
          )}
          {toolbar}
        </SearchExport>
      )}
      {subToolbar}
      
      <div className="rounded-md border overflow-hidden animate-scale-in">
        <div className="overflow-x-auto">
          <Table>
            <DataTableHeader
              columns={columns}
              sortConfig={sortConfig}
              onSort={handleSort}
              showActions={showActions}
            />
            <DataTableBody
              data={paginatedData}
              columns={columns}
              onRowClick={onRowClick}
              getRowActions={getRowActions}
              showActions={showActions}
            />
          </Table>
        </div>
      </div>
      
      <PaginationControls
        currentPage={Math.min(currentPage, totalPages)}
        totalPages={totalPages}
        totalItems={totalItems}
        rowsPerPage={rowsPerPage}
        handlePageChange={handlePageChange}
        handleRowsPerPageChange={handleRowsPerPageChange}
      />
    </div>
  );
}
