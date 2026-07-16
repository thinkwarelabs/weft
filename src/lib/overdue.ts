import { todayISO } from './dates'
import { InvoiceStatus } from './types'

function parseIsoDate(iso: string): { year: number; month0: number; day: number } {
  const [y, m, d] = iso.split('-').map((s) => parseInt(s, 10))
  return { year: y, month0: m - 1, day: d }
}

/** Overdue is derived, never a stored status: only a finalized invoice with a due date strictly before "today" counts. */
export function isOverdue(status: InvoiceStatus, dueDate: string, today: string = todayISO()): boolean {
  return status === 'finalized' && dueDate < today
}

/** Whole days between dueDate and today, computed via local-midnight `Date` construction to avoid TZ/DST traps. */
export function daysOverdue(dueDate: string, today: string = todayISO()): number {
  const due = parseIsoDate(dueDate)
  const now = parseIsoDate(today)
  const dueMs = new Date(due.year, due.month0, due.day).getTime()
  const nowMs = new Date(now.year, now.month0, now.day).getTime()
  return Math.round((nowMs - dueMs) / 86_400_000)
}
