import { round2 } from './money'

export type Granularity = 'month' | 'quarter' | 'half' | 'custom'

export interface PeriodSel {
  granularity: Granularity
  year: number
  /** month: 0-11, quarter: 0-3, half: 0-1. Unused for custom. */
  index: number
  /** Only used for granularity 'custom'. */
  from?: string
  to?: string
}

export interface RevenueRow {
  currency: string
  subtotal: number
  tax_amount: number
  total: number
  paidDate: string
}

export interface ExpenseRow {
  currency: string
  amount: number
  expense_date: string
}

export interface CurrencyBucket {
  currency: string
  exGst: number
  gst: number
  total: number
  expenses: number
  net: number
}

const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const MONTH_NAMES_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const QUARTER_LABELS = ['JFM', 'AMJ', 'JAS', 'OND']
const HALF_LABELS = ['Jan–Jun', 'Jul–Dec']

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

function isoDateStr(year: number, month0: number, day: number): string {
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`
}

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}

function parseIsoDate(iso: string): { year: number; month0: number; day: number } {
  const [y, m, d] = iso.split('-').map((s) => parseInt(s, 10))
  return { year: y, month0: m - 1, day: d }
}

export function periodRange(sel: PeriodSel): { from: string; to: string } {
  if (sel.granularity === 'custom') {
    return { from: sel.from ?? '', to: sel.to ?? '' }
  }
  if (sel.granularity === 'month') {
    const month0 = sel.index
    return {
      from: isoDateStr(sel.year, month0, 1),
      to: isoDateStr(sel.year, month0, daysInMonth(sel.year, month0)),
    }
  }
  if (sel.granularity === 'quarter') {
    const startMonth = sel.index * 3
    const endMonth = startMonth + 2
    return {
      from: isoDateStr(sel.year, startMonth, 1),
      to: isoDateStr(sel.year, endMonth, daysInMonth(sel.year, endMonth)),
    }
  }
  // half
  const startMonth = sel.index * 6
  const endMonth = startMonth + 5
  return {
    from: isoDateStr(sel.year, startMonth, 1),
    to: isoDateStr(sel.year, endMonth, daysInMonth(sel.year, endMonth)),
  }
}

function formatCustomDate(iso: string): string {
  const { month0, day, year } = parseIsoDate(iso)
  return `${day} ${MONTH_NAMES_ABBR[month0]} ${year}`
}

export function periodLabel(sel: PeriodSel): string {
  if (sel.granularity === 'month') {
    return `${MONTH_NAMES_FULL[sel.index]} ${sel.year}`
  }
  if (sel.granularity === 'quarter') {
    return `${QUARTER_LABELS[sel.index]} ${sel.year}`
  }
  if (sel.granularity === 'half') {
    return `${HALF_LABELS[sel.index]} ${sel.year}`
  }
  const from = sel.from ?? ''
  const to = sel.to ?? ''
  return `${formatCustomDate(from)} – ${formatCustomDate(to)}`
}

export function shiftPeriod(sel: PeriodSel, delta: -1 | 1): PeriodSel {
  if (sel.granularity === 'custom') {
    return sel
  }
  const periodsPerYear = sel.granularity === 'month' ? 12 : sel.granularity === 'quarter' ? 4 : 2
  let index = sel.index + delta
  let year = sel.year
  if (index < 0) {
    index = periodsPerYear - 1
    year -= 1
  } else if (index >= periodsPerYear) {
    index = 0
    year += 1
  }
  return { ...sel, year, index }
}

export function monthsInRange(from: string, to: string): { year: number; month: number; label: string }[] {
  const start = parseIsoDate(from)
  const end = parseIsoDate(to)
  const result: { year: number; month: number; label: string }[] = []
  let year = start.year
  let month = start.month0
  while (year < end.year || (year === end.year && month <= end.month0)) {
    result.push({ year, month, label: `${MONTH_NAMES_ABBR[month]} ${year}` })
    month += 1
    if (month > 11) {
      month = 0
      year += 1
    }
  }
  return result
}

export function aggregate(revenue: RevenueRow[], expenses: ExpenseRow[]): CurrencyBucket[] {
  const map = new Map<string, { exGst: number; gst: number; total: number; expenses: number }>()

  const getBucket = (currency: string) => {
    let bucket = map.get(currency)
    if (!bucket) {
      bucket = { exGst: 0, gst: 0, total: 0, expenses: 0 }
      map.set(currency, bucket)
    }
    return bucket
  }

  for (const row of revenue) {
    const bucket = getBucket(row.currency)
    bucket.exGst += row.subtotal
    bucket.gst += row.tax_amount
    bucket.total += row.total
  }

  for (const row of expenses) {
    const bucket = getBucket(row.currency)
    bucket.expenses += row.amount
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, bucket]) => {
      const exGst = round2(bucket.exGst)
      const gst = round2(bucket.gst)
      const total = round2(bucket.total)
      const expensesTotal = round2(bucket.expenses)
      return {
        currency,
        exGst,
        gst,
        total,
        expenses: expensesTotal,
        net: round2(total - expensesTotal),
      }
    })
}

export function monthlyBreakdown(
  from: string,
  to: string,
  revenue: RevenueRow[],
  expenses: ExpenseRow[]
): { label: string; buckets: CurrencyBucket[] }[] {
  return monthsInRange(from, to).map(({ year, month, label }) => {
    const revenueForMonth = revenue.filter((row) => {
      const d = parseIsoDate(row.paidDate)
      return d.year === year && d.month0 === month
    })
    const expensesForMonth = expenses.filter((row) => {
      const d = parseIsoDate(row.expense_date)
      return d.year === year && d.month0 === month
    })
    return { label, buckets: aggregate(revenueForMonth, expensesForMonth) }
  })
}
