import { round2 } from './money'

interface PartyLocation {
  state?: string | null
  country?: string | null
}

export interface GstRow {
  label: string
  rate: number
  amount: number
}

const norm = (s?: string | null) => (s ?? '').trim().toLowerCase()

// An empty country is treated as India — the business profile and most
// clients leave it blank on domestic invoices.
const inIndia = (country?: string | null) => {
  const n = norm(country)
  return n === '' || n === 'india' || n === 'in' || n === 'bharat'
}

// Intra-state supply (supplier and place of supply in the same Indian state)
// attracts CGST + SGST; anything else — different states, imports, exports —
// attracts IGST. Unknown/blank states fall back to IGST.
export function isIntraState(business: PartyLocation, client: PartyLocation): boolean {
  return (
    inIndia(business.country) &&
    inIndia(client.country) &&
    norm(business.state) !== '' &&
    norm(business.state) === norm(client.state)
  )
}

export function gstBreakdown(taxRate: number, taxAmount: number, intraState: boolean): GstRow[] {
  if (taxRate <= 0) return []
  if (!intraState) return [{ label: 'IGST', rate: taxRate, amount: taxAmount }]
  const halfRate = Number((taxRate / 2).toFixed(2))
  const cgst = round2(taxAmount / 2)
  const sgst = round2(taxAmount - cgst)
  return [
    { label: 'CGST', rate: halfRate, amount: cgst },
    { label: 'SGST', rate: halfRate, amount: sgst },
  ]
}
