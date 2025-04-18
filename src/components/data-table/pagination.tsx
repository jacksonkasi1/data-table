"use client";

import {
    ChevronLeftIcon,
    ChevronRightIcon,
    DoubleArrowLeftIcon,
    DoubleArrowRightIcon,
  } from "@radix-ui/react-icons";
  import { Table } from "@tanstack/react-table";
  import { Button } from "@/components/ui/button";
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select";

  const getButtonSizeClass = (size: 'sm' | 'default' | 'lg') => {
    switch(size) {
      case 'sm': return 'h-7 w-7 p-0';
      case 'lg': return 'h-11 w-11 p-0';
      default: return 'h-8 w-8 p-0';
    }
  };
  
  interface DataTablePaginationProps<TData> {
    table: Table<TData>;
    totalItems?: number; // Total number of items from API
    totalSelectedItems?: number; // Total selected items across all pages
    pageSizeOptions?: number[]; // Custom page size options
    size?: 'sm' | 'default' | 'lg'; // Size prop for components
  }
  
  export function DataTablePagination<TData>({
    table,
    totalItems = 0,
    totalSelectedItems = 0,
    pageSizeOptions = [10, 20, 30, 40, 50], // Default options if none provided
    size = 'default'
  }: DataTablePaginationProps<TData>) {
    // Convert 'lg' size to 'default' for SelectTrigger since it only accepts 'sm' | 'default'
    const selectSize = size === 'lg' ? 'default' : size;
    
    return (
      <div className="flex w-full flex-col items-center justify-between gap-4 overflow-auto px-2 py-1 sm:flex-row sm:gap-8">
        <div className="flex-1 text-sm text-muted-foreground">
          {totalSelectedItems} of {totalItems} row(s) selected.
        </div>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6 lg:gap-8">
          <div className="flex items-center space-x-2">
            <p className="whitespace-nowrap text-sm font-medium">
              Rows per page
            </p>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value));
              }}
            >
              <SelectTrigger className={`cursor-pointer`} size={selectSize}>
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top" className="cursor-pointer">
                {pageSizeOptions.map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`} className="cursor-pointer">
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-center text-sm font-medium">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount() || 1}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              aria-label="Go to first page"
              variant="outline"
              className={`${getButtonSizeClass(size)} hidden lg:flex cursor-pointer`}
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <DoubleArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              aria-label="Go to previous page"
              variant="outline"
              className={`${getButtonSizeClass(size)} cursor-pointer`}
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              aria-label="Go to next page"
              variant="outline"
              className={`${getButtonSizeClass(size)} cursor-pointer`}
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              aria-label="Go to last page"
              variant="outline"
              className={`${getButtonSizeClass(size)} hidden lg:flex cursor-pointer`}
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <DoubleArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    );
  }