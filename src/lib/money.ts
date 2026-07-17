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

export interface LineBreakdown {
  net: number
  tax: number
  gross: number
}

export interface LineInput {
  qty: number
  unit_price: number
  gst_included?: boolean
}

// Per-line tax split. For a GST-inclusive line the entered gross is
// authoritative: net = round2(gross / (1 + r)) and tax = gross - net, so
// net + tax always lands exactly on what was typed (15000 stays 15000, never
// 14999.99). For an exclusive line: net = round2(qty * price), tax on top.
export function lineBreakdown(item: LineInput, taxRate: number): LineBreakdown {
  const r = taxRate / 100
  if (item.gst_included && r > 0) {
    const gross = lineAmount(item.qty, item.unit_price)
    const net = round2(gross / (1 + r))
    return { net, tax: round2(gross - net), gross }
  }
  const net = lineAmount(item.qty, item.unit_price)
  const tax = round2(net * r)
  return { net, tax, gross: round2(net + tax) }
}

// Items are the ENTERED values (unit_price as typed, with gst_included flag) —
// not pre-converted prices. Tax is computed per line and summed so that
// subtotal + taxAmount === total exactly, always.
export function computeTotals(items: LineInput[], taxRate: number): Totals {
  const lines = items.map((i) => lineBreakdown(i, taxRate))
  const subtotal = round2(lines.reduce((sum, l) => sum + l.net, 0))
  const taxAmount = round2(lines.reduce((sum, l) => sum + l.tax, 0))
  return { subtotal, taxAmount, total: round2(subtotal + taxAmount) }
}

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(amount)
}
