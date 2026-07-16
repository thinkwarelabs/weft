import { describe, expect, it } from 'vitest'
import { daysOverdue, isOverdue } from './overdue'
import { todayISO } from './dates'

describe('isOverdue', () => {
  it('is true for a finalized invoice with a due date in the past', () => {
    expect(isOverdue('finalized', '2026-07-01', '2026-07-10')).toBe(true)
  })

  it('is false when the due date is today', () => {
    expect(isOverdue('finalized', '2026-07-10', '2026-07-10')).toBe(false)
  })

  it('is false when the due date is in the future', () => {
    expect(isOverdue('finalized', '2026-07-20', '2026-07-10')).toBe(false)
  })

  it('is false for paid invoices even if past due', () => {
    expect(isOverdue('paid', '2026-07-01', '2026-07-10')).toBe(false)
  })

  it('is false for cancelled invoices even if past due', () => {
    expect(isOverdue('cancelled', '2026-07-01', '2026-07-10')).toBe(false)
  })

  it('is false for draft invoices even if past due', () => {
    expect(isOverdue('draft', '2026-07-01', '2026-07-10')).toBe(false)
  })

  it('defaults `today` to todayISO() when omitted', () => {
    // A due date far in the past relative to any real "today" must be overdue.
    expect(isOverdue('finalized', '2000-01-01')).toBe(true)
    // A due date far in the future must never be overdue.
    expect(isOverdue('finalized', '2999-12-31')).toBe(false)
    expect(isOverdue('finalized', todayISO(), todayISO())).toBe(false)
  })
})

describe('daysOverdue', () => {
  it('counts whole days between due date and today', () => {
    expect(daysOverdue('2026-07-01', '2026-07-10')).toBe(9)
  })

  it('is 0 when due today', () => {
    expect(daysOverdue('2026-07-10', '2026-07-10')).toBe(0)
  })

  it('handles a month boundary', () => {
    expect(daysOverdue('2026-06-28', '2026-07-02')).toBe(4)
  })

  it('handles a year boundary', () => {
    expect(daysOverdue('2025-12-30', '2026-01-03')).toBe(4)
  })

  it('defaults `today` to todayISO() when omitted', () => {
    expect(daysOverdue(todayISO(), todayISO())).toBe(0)
  })
})
