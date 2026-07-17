export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100

export interface Pagination {
  page: number // 1-based
  pageSize: number
  from: number // inclusive row index, for Supabase .range()
  to: number // inclusive row index, for Supabase .range()
}

// Parse ?page & ?pageSize into a safe, clamped range. Invalid/missing values
// fall back to sensible defaults so a bad query can never request the whole
// table or a negative range.
export function parsePagination(
  params: URLSearchParams,
  opts: { defaultPageSize?: number; maxPageSize?: number } = {}
): Pagination {
  const defaultPageSize = opts.defaultPageSize ?? DEFAULT_PAGE_SIZE
  const maxPageSize = opts.maxPageSize ?? MAX_PAGE_SIZE

  const page = Math.max(1, toInt(params.get('page'), 1))
  const pageSize = clamp(toInt(params.get('pageSize'), defaultPageSize), 1, maxPageSize)

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  return { page, pageSize, from, to }
}

// Total number of pages for a given row count and page size (>= 1).
export function pageCount(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1
  return Math.max(1, Math.ceil(total / pageSize))
}

function toInt(value: string | null, fallback: number): number {
  // Number(null) and Number('') are both 0, which would mask a missing param;
  // treat empty/absent as "not provided" and fall back.
  if (value == null || value.trim() === '') return fallback
  const n = Number(value)
  return Number.isInteger(n) ? n : fallback
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
