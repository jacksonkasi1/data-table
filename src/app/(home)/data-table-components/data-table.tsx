"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  Row,
  ColumnResizeMode,
} from "@tanstack/react-table";
import { useEffect, useCallback, useMemo, useRef } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DataTablePagination } from "@/components/data-table/pagination";
import { DataTableToolbar } from "@/components/data-table/toolbar";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { getColumns } from "./columns";
import { useUrlState } from "@/components/data-table/utils/url-state";
import { useTableConfig, TableConfig } from "@/components/data-table/table-config";
import { useTableColumnResize } from "@/components/data-table/hooks/use-table-column-resize";
import { DataTableResizer } from "@/components/data-table/data-table-resizer";

// Import the extracted modules
import { useUsersData, useUserSelection } from "./data-fetching";
import { useExportConfig } from "./export-config";

interface DataTableProps {
  // Allow overriding the table configuration
  config?: Partial<TableConfig>;
}

export function DataTable({ config = {} }: DataTableProps) {
  // Load table configuration with any overrides
  const tableConfig = useTableConfig(config);
  
  // Table ID for localStorage storage - generate a default if not provided
  const tableId = tableConfig.columnResizingTableId || 'data-table-default';
  
  // Use our custom hook for column resizing
  const { columnSizing, setColumnSizing, resetColumnSizing } = useTableColumnResize(
    tableId,
    tableConfig.enableColumnResizing
  );
  
  // Create a wrapper for useUrlState that respects the enableUrlState config
  const useConditionalUrlState = <T,>(key: string, defaultValue: T, options = {}): readonly [T, React.Dispatch<React.SetStateAction<T>>] => {
    const [state, setState] = React.useState<T>(defaultValue);
    
    // Only use URL state if enabled in config
    if (tableConfig.enableUrlState) {
      return useUrlState<T>(key, defaultValue, options);
    }
    
    // Otherwise use regular React state
    return [state, setState] as const;
  };
  
  // States for API parameters using conditional URL state
  const [page, setPage] = useConditionalUrlState("page", 1);
  const [pageSize, setPageSize] = useConditionalUrlState("pageSize", 10);
  const [search, setSearch] = useConditionalUrlState("search", "");
  const [dateRange, setDateRange] = useConditionalUrlState<{ from_date: string; to_date: string }>("dateRange", { from_date: "", to_date: "" });
  const [sortBy, setSortBy] = useConditionalUrlState("sortBy", "created_at");
  const [sortOrder, setSortOrder] = useConditionalUrlState<"asc" | "desc">("sortOrder", "desc");
  const [columnVisibility, setColumnVisibility] = useConditionalUrlState<Record<string, boolean>>("columnVisibility", {});
  const [columnFilters, setColumnFilters] = useConditionalUrlState<Array<{ id: string; value: any }>>("columnFilters", []);

  // Convert the sorting from URL to the format TanStack Table expects
  const sorting: SortingState = useMemo(() => {
    return sortBy && sortOrder
      ? [{ id: sortBy, desc: sortOrder === "desc" }]
      : [];
  }, [sortBy, sortOrder]);

  // Ref for the table container for keyboard navigation
  const tableContainerRef = useRef<HTMLDivElement>(null!);
  
  // Fetch users data using the extracted hook
  const { data, isLoading, isError, error } = useUsersData(
    page,
    pageSize,
    search,
    dateRange,
    sortBy,
    sortOrder
  );

  // Use the extracted user selection hooks
  const {
    rowSelection,
    selectedUserIds,
    setSelectedUserIds,
    totalSelectedItems,
    handleRowDeselection,
    handleRowSelectionChange,
    getSelectedUsers,
    getAllUsers
  } = useUserSelection(data);

  // Get export configuration
  const exportConfig = useExportConfig();
  
  // Handle custom keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // If the key is Space or Enter and we're not in an input/button, handle row selection/activation
    if ((e.key === " " || e.key === "Enter") && 
        !(e.target as HTMLElement).matches('input, button, [role="button"], [contenteditable="true"]')) {
      // Prevent default behavior
      e.preventDefault();
      
      // Find the focused row or cell
      const focusedElement = document.activeElement;
      if (focusedElement && (
          focusedElement.getAttribute('role') === 'row' || 
          focusedElement.getAttribute('role') === 'gridcell'
      )) {
        // Find the closest row
        const rowElement = focusedElement.getAttribute('role') === 'row' 
          ? focusedElement 
          : focusedElement.closest('[role="row"]');
          
        if (rowElement) {
          // Get the row index from the data-row-index attribute or the row id
          const rowId = rowElement.getAttribute('data-row-index') || rowElement.id;
          if (rowId) {
            // Find the row by index and toggle its selection
            const rowIndex = parseInt(rowId.replace(/^row-/, ''), 10);
            const row = table.getRowModel().rows[rowIndex];
            if (row) {
              if (e.key === " ") {
                // Space toggles selection
                row.toggleSelected();
              } else if (e.key === "Enter") {
                // Enter activates the row - you can add custom action here
                console.log(`Row ${rowIndex} activated`, row.original);
                // Example: Navigate to detail page or open modal with the row data
                // window.location.href = `/users/${row.original.id}`;
              }
            }
          }
        }
      }
    }
  }, []);

  // Memoize data to ensure stable reference
  const tableData = useMemo(() => data?.data || [], [data?.data]);
  
  // Memoized pagination state
  const pagination = useMemo(
    () => ({
      pageIndex: page - 1,
      pageSize,
    }),
    [page, pageSize]
  );

  // Get columns with the deselection handler (memoize to avoid recreation on render)
  const columns = useMemo(() => {
    // If row selection is disabled, pass null as the handler which will hide the checkbox column
    return getColumns(tableConfig.enableRowSelection ? handleRowDeselection : null);
  }, [handleRowDeselection, tableConfig.enableRowSelection]);

  // Handler for sorting changes
  const handleSortingChange = useCallback((updaterOrValue: any) => {
    // Handle both direct values and updater functions
    const newSorting = typeof updaterOrValue === 'function'
      ? updaterOrValue(sorting)
      : updaterOrValue;
    
    if (newSorting.length > 0) {
      setSortBy(newSorting[0].id);
      setSortOrder(newSorting[0].desc ? "desc" : "asc");
    } else {
      // Default sorting
      setSortBy("created_at");
      setSortOrder("desc");
    }
  }, [setSortBy, setSortOrder, sorting]);

  // Handler for column filter changes
  const handleColumnFiltersChange = useCallback((updaterOrValue: any) => {
    // Pass through to setColumnFilters (which handles updater functions)
    setColumnFilters(updaterOrValue);
  }, [setColumnFilters]);

  // Handler for column visibility changes
  const handleColumnVisibilityChange = useCallback((updaterOrValue: any) => {
    // Pass through to setColumnVisibility (which handles updater functions)
    setColumnVisibility(updaterOrValue);
  }, [setColumnVisibility]);

  // Handler for pagination changes
  const handlePaginationChange = useCallback((updaterOrValue: any) => {
    // Handle both direct values and updater functions
    const newPagination = typeof updaterOrValue === 'function'
      ? updaterOrValue({ pageIndex: page - 1, pageSize })
      : updaterOrValue;
    
    setPage(newPagination.pageIndex + 1);
    setPageSize(newPagination.pageSize);
  }, [setPage, setPageSize, page, pageSize]);

  // Handler for column sizing changes
  const handleColumnSizingChange = useCallback((updaterOrValue: any) => {
    // Handle both direct values and updater functions
    const newSizing = typeof updaterOrValue === 'function'
      ? updaterOrValue(columnSizing)
      : updaterOrValue;
    setColumnSizing(newSizing);
  }, [columnSizing, setColumnSizing]);

  // When data loads, sync rowSelection with selected user IDs
  useEffect(() => {
    if (data?.data) {
      const newRowSelection: Record<string, boolean> = {};
      
      // Map the current page's rows to their selection state
      data.data.forEach((user, index) => {
        if (selectedUserIds[user.id]) {
          newRowSelection[index] = true;
        }
      });
      
      // Only update if there's an actual change to prevent infinite loops
      if (JSON.stringify(newRowSelection) !== JSON.stringify(rowSelection)) {
        handleRowSelectionChange(newRowSelection);
      }
    }
  }, [data?.data, selectedUserIds, handleRowSelectionChange, rowSelection]);

  // Set up the table
  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
      columnSizing,
    },
    columnResizeMode: 'onChange' as ColumnResizeMode,
    onColumnSizingChange: handleColumnSizingChange,
    pageCount: data?.pagination.total_pages || 0,
    enableRowSelection: tableConfig.enableRowSelection,
    enableColumnResizing: tableConfig.enableColumnResizing,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    onRowSelectionChange: handleRowSelectionChange,
    onSortingChange: handleSortingChange,
    onColumnFiltersChange: handleColumnFiltersChange,
    onColumnVisibilityChange: handleColumnVisibilityChange,
    onPaginationChange: handlePaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  // Initialize default column sizes when columns are available and no saved sizes exist
  useEffect(() => {
    if (columns.length > 0 && Object.keys(columnSizing).length === 0) {
      // Create a map of column id to its default size
      const defaultSizing: Record<string, number> = {};
      columns.forEach(column => {
        if ('id' in column && column.id && 'size' in column && typeof column.size === 'number') {
          defaultSizing[column.id] = column.size;
        } else if ('accessorKey' in column && typeof column.accessorKey === 'string' && 'size' in column && typeof column.size === 'number') {
          defaultSizing[column.accessorKey] = column.size;
        }
      });
      
      // Only set if we have sizes to apply and there are no saved sizes in localStorage
      if (Object.keys(defaultSizing).length > 0) {
        // Check localStorage first
        try {
          const savedSizing = localStorage.getItem(`table-column-sizing-${tableId}`);
          if (!savedSizing) {
            // Only apply defaults if no saved sizing exists
            setColumnSizing(defaultSizing);
          }
        } catch (error) {
          // If localStorage fails, apply defaults
          setColumnSizing(defaultSizing);
        }
      }
    }
  }, [columns, columnSizing, setColumnSizing, tableId]);

  // Update to use data attribute instead of class for better performance
  useEffect(() => {
    const isResizingAny = 
      table.getHeaderGroups().some(headerGroup => 
        headerGroup.headers.some(header => header.column.getIsResizing())
      );
    
    if (isResizingAny) {
      document.body.setAttribute('data-resizing', 'true');
    } else {
      document.body.removeAttribute('data-resizing');
    }
    
    // Cleanup on unmount
    return () => {
      document.body.removeAttribute('data-resizing');
    };
  }, [table]);

  // Handle error state
  if (isError) {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load users: {error instanceof Error ? error.message : "Unknown error"}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {tableConfig.enableToolbar && (
        <DataTableToolbar
          table={table}
          setSearch={setSearch}
          setDateRange={setDateRange}
          totalSelectedItems={totalSelectedItems}
          deleteSelection={
            () => {
              table.resetRowSelection();
              setSelectedUserIds({});
            }
          }
          getSelectedItems={getSelectedUsers}
          getAllItems={getAllUsers}
          config={tableConfig}
          resetColumnSizing={() => {
            resetColumnSizing();
            // Force a small delay and then refresh the UI
            setTimeout(() => {
              window.dispatchEvent(new Event('resize'));
            }, 100);
          }}
          entityName={exportConfig.entityName}
          columnMapping={exportConfig.columnMapping}
          columnWidths={exportConfig.columnWidths}
          headers={exportConfig.headers}
        />
      )}
      
      <div 
        ref={tableContainerRef} 
        className="overflow-y-auto rounded-md border table-container" 
        role="grid"
        tabIndex={0}
        aria-label="Data table"
        onKeyDown={tableConfig.enableKeyboardNavigation ? handleKeyDown : undefined}
      >
        <Table className={tableConfig.enableColumnResizing ? "resizable-table" : ""}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow 
                key={headerGroup.id}
                role="row"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    className="px-4 py-2 group/th relative"
                    key={header.id}
                    colSpan={header.colSpan}
                    role="columnheader"
                    tabIndex={-1}
                    style={{
                      width: header.getSize(),
                    }}
                    data-column-resizing={header.column.getIsResizing() ? "true" : undefined}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                    {tableConfig.enableColumnResizing && header.column.getCanResize() && (
                      <DataTableResizer header={header} table={table} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          
          <TableBody>
            {isLoading ? (
              // Loading state
              Array.from({ length: pageSize }).map((_, i) => (
                <TableRow 
                  key={`skeleton-${i}`}
                  role="row"
                  tabIndex={-1}
                >
                  {Array.from({ length: columns.length }).map((_, j) => (
                    <TableCell 
                      key={`skeleton-cell-${j}`} 
                      className="px-4 py-2"
                      role="gridcell"
                      tabIndex={-1}
                    >
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              // Data rows
              table.getRowModel().rows.map((row, rowIndex) => (
                <TableRow
                  key={row.id}
                  id={`row-${rowIndex}`}
                  data-row-index={rowIndex}
                  data-state={row.getIsSelected() && "selected"}
                  tabIndex={0}
                  role="row"
                  aria-selected={row.getIsSelected()}
                  onClick={tableConfig.enableClickRowSelect ? () => row.toggleSelected() : undefined}
                  onFocus={(e) => {
                    // Add a data attribute to the currently focused row
                    // Remove it from all other rows first
                    document.querySelectorAll('[data-focused="true"]')
                      .forEach(el => el.removeAttribute('data-focused'));
                    e.currentTarget.setAttribute('data-focused', 'true');
                  }}
                >
                  {row.getVisibleCells().map((cell, cellIndex) => (
                    <TableCell 
                      className="px-4 py-2" 
                      key={cell.id}
                      id={`cell-${rowIndex}-${cellIndex}`}
                      data-cell-index={cellIndex}
                      role="gridcell"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              // No results
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {tableConfig.enablePagination && (
        <DataTablePagination 
          table={table} 
          totalItems={data?.pagination.total_items || 0}
        />
      )}
    </div>
  );
}