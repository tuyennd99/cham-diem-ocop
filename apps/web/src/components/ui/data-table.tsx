'use client';

import {
  type CellData,
  type ColumnDef,
  type RowData,
  type SortingState,
  type TableFeatures,
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  flexRender,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DebouncedInput } from '@/components/debounced-input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { type DataTableParams, getPageCount } from '@/lib/data-table-utils';
import { type CSSProperties, type ReactNode, useCallback, useEffect, useState } from 'react';
import { DEFAULT_PAGE_SIZE, LIST_PAGE_SIZES } from '@/constants/consts';

// Cột chia theo phần trăm: TanStack `size` chỉ nhận số (px) nên bề rộng % đi
// qua meta.width. Có ít nhất một cột khai báo width thì bảng chuyển table-fixed,
// nhờ vậy truncate trong cell mới có chỗ để cắt.
declare module '@tanstack/react-table' {
  interface ColumnMeta<
    in out TFeatures extends TableFeatures,
    in out TData extends RowData,
    TValue extends CellData = CellData,
  > {
    width?: string;
    align?: 'left' | 'center' | 'right';
    headerClassName?: string;
    cellClassName?: string;
    cellStyle?: CSSProperties;
    isRowHeader?: boolean;
  }
}

export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
});

export type DataTableFeatures = typeof dataTableFeatures;
export type DataTableColumnDef<
  TData extends RowData,
  TValue extends CellData = CellData,
> = ColumnDef<DataTableFeatures, TData, TValue>;

interface DataTableProps<T extends RowData> {
  columns: ColumnDef<DataTableFeatures, T, any>[];
  data: T[];
  /** Total rows across all pages. Required in server mode; ignored client-side. */
  total?: number;
  loading?: boolean;
  /** Controlled 1-based page index for URL-synced server pagination. */
  page?: number;
  /** Controlled page size for URL-synced server pagination. */
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  /** Emitted on every page/size/sort/search change in server mode. */
  onParamsChange?: (params: DataTableParams) => void;
  /** true (default) = server-side (manual) pagination; false = client-side over `data`. */
  manual?: boolean;
  /** Enable column sorting headers (default false when not needed). */
  enableSorting?: boolean;
  /** Show pagination footer (default true). */
  paginated?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  getRowId?: (originalRow: T, index: number) => string;
  emptyMessage?: ReactNode;
  footer?: ReactNode;
  className?: string;
  tableClassName?: string;
}

export function DataTable<T extends RowData>({
  columns,
  data,
  total = 0,
  loading = false,
  page: controlledPage,
  pageSize: controlledPageSize,
  onPageChange,
  onPageSizeChange,
  onParamsChange,
  manual = true,
  enableSorting = false,
  paginated = true,
  searchable = false,
  searchPlaceholder = 'Tìm kiếm...',
  defaultPageSize = DEFAULT_PAGE_SIZE,
  pageSizeOptions = LIST_PAGE_SIZES,
  getRowId,
  emptyMessage = 'Không có dữ liệu',
  footer,
  className,
  tableClassName,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [internalPagination, setInternalPagination] = useState({
    pageIndex: (controlledPage ?? 1) - 1,
    pageSize: controlledPageSize ?? defaultPageSize,
  });

  const pagination = {
    pageIndex: controlledPage !== undefined ? Math.max(0, controlledPage - 1) : internalPagination.pageIndex,
    pageSize: controlledPageSize !== undefined ? controlledPageSize : internalPagination.pageSize,
  };

  const handlePaginationChange = useCallback(
    (updater: typeof pagination | ((prev: typeof pagination) => typeof pagination)) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater;
      setInternalPagination(next);
      if (next.pageSize !== pagination.pageSize) {
        onPageSizeChange?.(next.pageSize);
      }
      if (next.pageIndex !== pagination.pageIndex) {
        onPageChange?.(next.pageIndex + 1);
      }
    },
    [pagination, onPageChange, onPageSizeChange],
  );

  // Reset to first page when the (debounced) search changes.
  const handleSearch = useCallback(
    (value: string) => {
      handlePaginationChange((p) => ({ ...p, pageIndex: 0 }));
      setGlobalFilter(value);
    },
    [handlePaginationChange],
  );

  const effectiveManualPagination = manual || !paginated;

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    getRowId,
    enableSorting,
    state: { sorting, globalFilter, pagination },
    onSortingChange: (updater) => {
      handlePaginationChange((p) => ({ ...p, pageIndex: 0 }));
      setSorting(updater);
    },
    onPaginationChange: handlePaginationChange,
    onGlobalFilterChange: setGlobalFilter,
    manualPagination: effectiveManualPagination,
    manualSorting: manual,
    manualFiltering: manual,
    pageCount: manual ? getPageCount(total, pagination.pageSize) : undefined,
  });

  // In server mode, report state changes so the parent can refetch.
  useEffect(() => {
    if (!manual || !onParamsChange) return;
    const sort = sorting[0] ?? null;
    onParamsChange({
      page: pagination.pageIndex + 1,
      limit: pagination.pageSize,
      sort: sort ? { id: sort.id, desc: sort.desc } : null,
      search: globalFilter,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manual, pagination.pageIndex, pagination.pageSize, sorting, globalFilter]);

  const rows = table.getRowModel().rows;
  const leafColumns = table.getVisibleLeafColumns();
  const fixed = leafColumns.some((column) => column.columnDef.meta?.width);
  const pageCount = Math.max(1, table.getPageCount());
  const currentPage = table.state.pagination.pageIndex + 1;

  return (
    <div className={cn(searchable && 'space-y-3', className)}>
      {searchable && (
        <DebouncedInput
          value={globalFilter}
          onValueChange={handleSearch}
          delay={300}
          placeholder={searchPlaceholder}
          className='max-w-xs'
        />
      )}

      {/* TableCell/TableHead mặc định p-2 nên ô đầu (thường là checkbox) chỉ
        * cách viền 8px, nhìn như dính viền. Nới ô đầu và ô cuối của mọi hàng. */}
      <Table
        className={cn(
          'admin-data-table [&_tr>*:first-child]:pl-4 [&_tr>*:last-child]:pr-4',
          fixed && 'table-fixed',
          tableClassName,
        )}
      >
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => {
                if (header.rowSpan === 0) return null;
                const meta = header.column.columnDef.meta;
                const canSort = !header.isPlaceholder && header.column.getCanSort();
                const dir = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    scope={header.colSpan > 1 ? 'colgroup' : 'col'}
                    colSpan={header.colSpan > 1 ? header.colSpan : undefined}
                    rowSpan={header.rowSpan > 1 ? header.rowSpan : undefined}
                    className={meta?.headerClassName}
                    style={{
                      width: meta?.width,
                      textAlign: meta?.align,
                    }}
                  >
                    {canSort ? (
                      <button
                        type='button'
                        className={cn(
                          'flex items-center gap-1',
                          meta?.align === 'right' && 'ml-auto',
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {dir === 'asc' ? (
                          <ChevronUp className='size-4' />
                        ) : dir === 'desc' ? (
                          <ChevronDown className='size-4' />
                        ) : (
                          <ChevronsUpDown className='size-4 opacity-50' />
                        )}
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {loading ? (
            Array.from({ length: pagination.pageSize }).map((_, r) => (
              <TableRow key={`sk-${r}`}>
                {leafColumns.map((col) => (
                  <TableCell key={col.id}>
                    <Skeleton className='h-4 w-full' />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={Math.max(1, leafColumns.length)}
                className='text-muted-foreground h-24 text-center'
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta;
                  const cellContent = flexRender(
                    cell.column.columnDef.cell,
                    cell.getContext(),
                  );
                  const cellStyle: CSSProperties = {
                    textAlign: meta?.align,
                    ...meta?.cellStyle,
                  };
                  // if (meta?.isRowHeader) {
                  //   return (
                  //     <th
                  //       key={cell.id}
                  //       scope='row'
                  //       className={cn(
                  //         'p-3 align-middle font-semibold',
                  //         meta.cellClassName,
                  //       )}
                  //       style={cellStyle}
                  //     >
                  //       {cellContent}
                  //     </th>
                  //   );
                  // }
                  return (
                    <TableCell
                      key={cell.id}
                      className={meta?.cellClassName}
                      style={cellStyle}
                    >
                      {cellContent}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>

        {footer && <TableFooter>{footer}</TableFooter>}
      </Table>

      {paginated && (
        <div className='table-footer flex items-center justify-between'>
          <Select
            value={String(table.state.pagination.pageSize)}
            onValueChange={(v) => {
              const nextSize = Number(v);
              handlePaginationChange({ pageIndex: 0, pageSize: nextSize });
            }}
          >
            <SelectTrigger className='h-9 min-h-9 w-28'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((opt) => (
                <SelectItem key={opt} value={String(opt)}>
                  {opt} / trang
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className='pagination-actions flex items-center gap-2'>
            <span className='text-muted-foreground text-sm'>
              Trang {currentPage} / {pageCount}
            </span>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className='size-4' />
            </Button>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className='size-4' />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
