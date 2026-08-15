'use client'
// Moved from the pre-shadcn kit. No registry equivalent exists, so it stays
// local — but it now lives in ui/ and uses the shared cn/tokens.
import { Button } from '@/components/ui/button'
import { Select } from './select-field'

export const PAGE_SIZES = [10, 25, 50, 100]

// Shared pager: "{total} items" on the left, a rows-per-page selector plus
// page position and Prev/Next on the right. Works for both server-side
// (Invoices, Clients) and client-side (Financials) pagination — the parent owns
// the page/pageSize state and just reacts to the callbacks.
export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  disabled = false,
  singular = 'entry',
  plural = 'entries',
}: {
  page: number
  pageCount: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  disabled?: boolean
  singular?: string
  plural?: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-sm text-zinc-500">
        {total.toLocaleString()} {total === 1 ? singular : plural}
      </p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-500">Rows</span>
          <div className="w-20">
            <Select
              value={String(pageSize)}
              onChange={(v: string) => onPageSizeChange(Number(v))}
              options={PAGE_SIZES.map((s) => ({ value: String(s), label: String(s) }))}
            />
          </div>
        </div>
        <span className="whitespace-nowrap text-sm text-zinc-500">
          Page {page} of {pageCount}
        </span>
        <Button
          variant="ghost"
          className="h-8 px-3"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="ghost"
          className="h-8 px-3"
          disabled={disabled || page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
