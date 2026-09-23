import type { ReactNode } from 'react';
import type { SortOrder } from '@/components/SortControl/SortControl.types';

export interface Column<T> {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  render: (row: T) => ReactNode;
  /** Field this column sorts by; makes the header clickable when the table has `sort`. */
  sortKey?: string;
}

export interface TableSort {
  by: string;
  order: SortOrder;
  onChange: (by: string, order: SortOrder) => void;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  page: number; // 1-based
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  emptyMessage?: string;
  /** Optional server-side sort, driven by the sortable column headers. */
  sort?: TableSort;
}
