
import { ReactNode } from "react";

export interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => ReactNode);
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  filterOptions?: string[] | ((data: T[]) => string[]);
  filterType?: 'select' | 'dateRange';
}

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig<T> {
  key: keyof T | null;
  direction: SortDirection;
}

export type Action<T> = {
  label: string;
  onClick: (row: T) => void;
  icon?: React.ReactNode;
};

export interface Filter<T> {
  column: keyof T;
  value: string | string[] | { from?: Date; to?: Date };
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  actions?: ((row: T) => Action<T>[]) | Action<T>[];
  pageSize?: number;
  serverSide?: boolean;
  totalCount?: number;
  onPaginationChange?: (page: number, pageSize: number) => void;
  onSearchChange?: (searchTerm: string) => void;
  onSortChange?: (sortKey: keyof T | null, direction: SortDirection) => void;
  onFilterChange?: (filters: Filter<T>[]) => void;
  showFilters?: boolean;
  /** Extra controls rendered at the right end of the search row (e.g. a page's own FilterButton). */
  toolbar?: ReactNode;
  /** Shown between the search row and the table (e.g. active filter chips). */
  subToolbar?: ReactNode;
  /** Server-side tables: changing this sends the table back to page 1 (e.g. when the page's own filters change). */
  pageResetKey?: string;
}
