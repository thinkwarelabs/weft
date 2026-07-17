import { describe, expect, it } from 'vitest'
import { computeTotals, formatMoney, lineAmount, lineBreakdown, round2 } from './money'

describe('round2', () => {
  it('rounds to 2 decimals', () => {
    expect(round2(3.605)).toBe(3.61)
    expect(round2(0.1 + 0.2)).toBe(0.3)
  })
})

describe('lineAmount', () => {
  it('multiplies qty by unit price and rounds', () => {
    expect(lineAmount(1, 20)).toBe(20)
    expect(lineAmount(3, 33.335)).toBe(100.01)
  })
})

describe('computeTotals', () => {
  it('matches the template invoice: 1 x $20 at 18% -> 20 / 3.6 / 23.6', () => {
    const t = computeTotals([{ qty: 1, unit_price: 20 }], 18)
    expect(t).toEqual({ subtotal: 20, taxAmount: 3.6, total: 23.6 })
  })
  it('sums multiple rounded lines and handles 0% tax', () => {
    const t = computeTotals([{ qty: 2, unit_price: 10.005 }, { qty: 1, unit_price: 5 }], 0)
    expect(t).toEqual({ subtotal: 25.01, taxAmount: 0, total: 25.01 })
  })
  it('GST-inclusive line lands exactly on the entered amount', () => {
    const t = computeTotals([{ qty: 1, unit_price: 15000, gst_included: true }], 18)
    expect(t).toEqual({ subtotal: 12711.86, taxAmount: 2288.14, total: 15000 })
  })
  it('mixed inclusive and exclusive lines stay self-consistent', () => {
    const t = computeTotals(
      [
        { qty: 1, unit_price: 15000, gst_included: true },
        { qty: 1, unit_price: 1000, gst_included: false },
      ],
      18
    )
    expect(t).toEqual({ subtotal: 13711.86, taxAmount: 2468.14, total: 16180 })
    expect(round2(t.subtotal + t.taxAmount)).toBe(t.total)
  })
})

describe('lineBreakdown', () => {
  it('inclusive: net + tax equals the entered gross exactly', () => {
    const l = lineBreakdown({ qty: 1, unit_price: 15000, gst_included: true }, 18)
    expect(l).toEqual({ net: 12711.86, tax: 2288.14, gross: 15000 })
  })
  it('exclusive: tax added on top of the entered net', () => {
    const l = lineBreakdown({ qty: 1, unit_price: 1000, gst_included: false }, 18)
    expect(l).toEqual({ net: 1000, tax: 180, gross: 1180 })
  })
  it('inclusive with 0% tax is a no-op', () => {
    const l = lineBreakdown({ qty: 1, unit_price: 500, gst_included: true }, 0)
    expect(l).toEqual({ net: 500, tax: 0, gross: 500 })
  })
})

describe('formatMoney', () => {
  it('formats USD and INR', () => {
    expect(formatMoney(23.6, 'USD')).toBe('$23.60')
    expect(formatMoney(1500, 'INR')).toBe('₹1,500.00')
  })
})
