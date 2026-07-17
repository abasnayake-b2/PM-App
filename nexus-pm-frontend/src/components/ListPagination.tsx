import type { PageResponse } from '@/types';

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;

interface ListPaginationProps<T> {
  page: PageResponse<T> | undefined;
  pageIndex: number;
  pageSize: number;
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  itemLabel?: string;
}

/**
 * Shared list/grid pager. Place **above** the table or card grid everywhere in the app.
 */
export function ListPagination<T>({
  page,
  pageIndex,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'items',
}: ListPaginationProps<T>) {
  if (!page || page.totalElements === 0) {
    return null;
  }

  const totalPages = Math.max(page.totalPages, 1);
  const from = pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, page.totalElements);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-text2">
        Showing {from}–{to} of {page.totalElements} {itemLabel}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-text2">
          <span>Per page</span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageChange(0);
              onPageSizeChange(Number(e.target.value));
            }}
            className="rounded-lg border border-border bg-bg3 px-2 py-1.5 text-sm text-text1"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(pageIndex - 1)}
            disabled={pageIndex <= 0}
            className="rounded-lg border border-border px-3 py-1.5 hover:bg-bg3 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="tabular-nums text-text2">
            Page {pageIndex + 1} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(pageIndex + 1)}
            disabled={pageIndex >= totalPages - 1}
            className="rounded-lg border border-border px-3 py-1.5 hover:bg-bg3 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
