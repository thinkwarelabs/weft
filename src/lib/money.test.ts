import { describe, expect, it } from 'vitest'
import { computeTotals, formatMoney, lineAmount, round2 } from './money'

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
})

describe('formatMoney', () => {
  it('formats USD and INR', () => {
    expect(formatMoney(23.6, 'USD')).toBe('$23.60')
    expect(formatMoney(1500, 'INR')).toBe('₹1,500.00')
  })
})
