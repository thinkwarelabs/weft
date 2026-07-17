export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function lineAmount(qty: number, unitPrice: number): number {
  return round2(qty * unitPrice)
}

// A "GST included" price is converted to its pre-tax equivalent at full
// precision — rounding happens later, per line, in lineAmount.
export function preTaxUnitPrice(unitPrice: number, gstIncluded: boolean, taxRate: number): number {
  return gstIncluded ? unitPrice / (1 + taxRate / 100) : unitPrice
}

export interface Totals {
  subtotal: number
  taxAmount: number
  total: number
}

export function computeTotals(
  items: { qty: number; unit_price: number }[],
  taxRate: number
): Totals {
  const subtotal = round2(items.reduce((sum, i) => sum + lineAmount(i.qty, i.unit_price), 0))
  const taxAmount = round2(subtotal * (taxRate / 100))
  return { subtotal, taxAmount, total: round2(subtotal + taxAmount) }
}

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(amount)
}
