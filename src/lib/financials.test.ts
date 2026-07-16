import { describe, expect, it } from 'vitest'
import {
  aggregate,
  monthlyBreakdown,
  monthsInRange,
  periodLabel,
  periodRange,
  shiftPeriod,
  type ExpenseRow,
  type PeriodSel,
  type RevenueRow,
} from './financials'

describe('periodRange', () => {
  it('returns the full month for a month selection', () => {
    const sel: PeriodSel = { granularity: 'month', year: 2026, index: 6 } // July
    expect(periodRange(sel)).toEqual({ from: '2026-07-01', to: '2026-07-31' })
  })

  it('handles a leap-year February', () => {
    const sel: PeriodSel = { granularity: 'month', year: 2028, index: 1 } // Feb, leap year
    expect(periodRange(sel)).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })

  it('handles a non-leap-year February', () => {
    const sel: PeriodSel = { granularity: 'month', year: 2026, index: 1 }
    expect(periodRange(sel)).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })

  it('returns JFM for quarter index 0', () => {
    const sel: PeriodSel = { granularity: 'quarter', year: 2026, index: 0 }
    expect(periodRange(sel)).toEqual({ from: '2026-01-01', to: '2026-03-31' })
  })

  it('returns OND for quarter index 3', () => {
    const sel: PeriodSel = { granularity: 'quarter', year: 2026, index: 3 }
    expect(periodRange(sel)).toEqual({ from: '2026-10-01', to: '2026-12-31' })
  })

  it('returns Jan-Jun for half index 0', () => {
    const sel: PeriodSel = { granularity: 'half', year: 2026, index: 0 }
    expect(periodRange(sel)).toEqual({ from: '2026-01-01', to: '2026-06-30' })
  })

  it('returns Jul-Dec for half index 1', () => {
    const sel: PeriodSel = { granularity: 'half', year: 2026, index: 1 }
    expect(periodRange(sel)).toEqual({ from: '2026-07-01', to: '2026-12-31' })
  })

  it('passes through from/to for custom', () => {
    const sel: PeriodSel = { granularity: 'custom', year: 2026, index: 0, from: '2026-07-12', to: '2026-08-31' }
    expect(periodRange(sel)).toEqual({ from: '2026-07-12', to: '2026-08-31' })
  })
})

describe('periodLabel', () => {
  it('formats a month label', () => {
    expect(periodLabel({ granularity: 'month', year: 2026, index: 6 })).toBe('July 2026')
  })

  it('formats a quarter label', () => {
    expect(periodLabel({ granularity: 'quarter', year: 2026, index: 0 })).toBe('JFM 2026')
  })

  it('formats a half label', () => {
    expect(periodLabel({ granularity: 'half', year: 2026, index: 0 })).toBe('Jan–Jun 2026')
  })

  it('formats a custom label', () => {
    const sel: PeriodSel = { granularity: 'custom', year: 2026, index: 0, from: '2026-07-12', to: '2026-08-31' }
    expect(periodLabel(sel)).toBe('12 Jul 2026 – 31 Aug 2026')
  })
})

describe('shiftPeriod', () => {
  it('moves to the next month within the same year', () => {
    const sel: PeriodSel = { granularity: 'month', year: 2026, index: 5 }
    expect(shiftPeriod(sel, 1)).toEqual({ granularity: 'month', year: 2026, index: 6 })
  })

  it('rolls over to the next year from December', () => {
    const sel: PeriodSel = { granularity: 'month', year: 2026, index: 11 }
    expect(shiftPeriod(sel, 1)).toEqual({ granularity: 'month', year: 2027, index: 0 })
  })

  it('rolls back to the previous year from January', () => {
    const sel: PeriodSel = { granularity: 'month', year: 2026, index: 0 }
    expect(shiftPeriod(sel, -1)).toEqual({ granularity: 'month', year: 2025, index: 11 })
  })

  it('rolls quarter index over into the next year', () => {
    const sel: PeriodSel = { granularity: 'quarter', year: 2026, index: 3 }
    expect(shiftPeriod(sel, 1)).toEqual({ granularity: 'quarter', year: 2027, index: 0 })
  })

  it('rolls half index over into the next year', () => {
    const sel: PeriodSel = { granularity: 'half', year: 2026, index: 1 }
    expect(shiftPeriod(sel, 1)).toEqual({ granularity: 'half', year: 2027, index: 0 })
  })

  it('is a no-op for custom ranges', () => {
    const sel: PeriodSel = { granularity: 'custom', year: 2026, index: 0, from: '2026-07-12', to: '2026-08-31' }
    expect(shiftPeriod(sel, 1)).toEqual(sel)
  })
})

describe('monthsInRange', () => {
  it('lists each month within a single-year range', () => {
    expect(monthsInRange('2026-01-01', '2026-03-31')).toEqual([
      { year: 2026, month: 0, label: 'Jan 2026' },
      { year: 2026, month: 1, label: 'Feb 2026' },
      { year: 2026, month: 2, label: 'Mar 2026' },
    ])
  })

  it('crosses a year boundary', () => {
    expect(monthsInRange('2025-12-01', '2026-01-31')).toEqual([
      { year: 2025, month: 11, label: 'Dec 2025' },
      { year: 2026, month: 0, label: 'Jan 2026' },
    ])
  })
})

describe('aggregate', () => {
  it('buckets mixed USD and INR rows', () => {
    const revenue: RevenueRow[] = [
      { currency: 'USD', subtotal: 100, tax_amount: 18, total: 118, paidDate: '2026-07-05' },
      { currency: 'USD', subtotal: 50, tax_amount: 9, total: 59, paidDate: '2026-07-20' },
      { currency: 'INR', subtotal: 1000, tax_amount: 180, total: 1180, paidDate: '2026-07-10' },
    ]
    const expenses: ExpenseRow[] = [
      { currency: 'USD', amount: 30, expense_date: '2026-07-15' },
      { currency: 'INR', amount: 200, expense_date: '2026-07-15' },
    ]
    expect(aggregate(revenue, expenses)).toEqual([
      { currency: 'INR', exGst: 1000, gst: 180, total: 1180, expenses: 200, net: 980 },
      { currency: 'USD', exGst: 150, gst: 27, total: 177, expenses: 30, net: 147 },
    ])
  })

  it('goes net negative when expenses exceed revenue', () => {
    const revenue: RevenueRow[] = [
      { currency: 'USD', subtotal: 10, tax_amount: 0, total: 10, paidDate: '2026-07-05' },
    ]
    const expenses: ExpenseRow[] = [{ currency: 'USD', amount: 50, expense_date: '2026-07-15' }]
    expect(aggregate(revenue, expenses)).toEqual([
      { currency: 'USD', exGst: 10, gst: 0, total: 10, expenses: 50, net: -40 },
    ])
  })

  it('returns empty buckets for empty inputs', () => {
    expect(aggregate([], [])).toEqual([])
  })
})

describe('monthlyBreakdown', () => {
  it('buckets a paid invoice and an expense into their respective months', () => {
    const revenue: RevenueRow[] = [
      { currency: 'USD', subtotal: 100, tax_amount: 18, total: 118, paidDate: '2026-07-05' },
    ]
    const expenses: ExpenseRow[] = [{ currency: 'USD', amount: 40, expense_date: '2026-08-10' }]

    const result = monthlyBreakdown('2026-07-01', '2026-08-31', revenue, expenses)

    expect(result).toEqual([
      {
        label: 'Jul 2026',
        buckets: [{ currency: 'USD', exGst: 100, gst: 18, total: 118, expenses: 0, net: 118 }],
      },
      {
        label: 'Aug 2026',
        buckets: [{ currency: 'USD', exGst: 0, gst: 0, total: 0, expenses: 40, net: -40 }],
      },
    ])
  })

  it('leaves empty buckets for months with no activity', () => {
    const result = monthlyBreakdown('2026-06-01', '2026-08-31', [], [])
    expect(result).toEqual([
      { label: 'Jun 2026', buckets: [] },
      { label: 'Jul 2026', buckets: [] },
      { label: 'Aug 2026', buckets: [] },
    ])
  })
})
