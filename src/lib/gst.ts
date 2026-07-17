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

// Export of services: client outside India. (Blank countries count as India,
// matching inIndia above.)
export function isExport(business: PartyLocation, client: PartyLocation): boolean {
  return inIndia(business.country) && !inIndia(client.country)
}

// GST state codes (first two digits of a GSTIN).
const STATE_CODES: Record<string, string> = {
  'jammu and kashmir': '01', 'himachal pradesh': '02', punjab: '03', chandigarh: '04',
  uttarakhand: '05', haryana: '06', delhi: '07', rajasthan: '08', 'uttar pradesh': '09',
  bihar: '10', sikkim: '11', 'arunachal pradesh': '12', nagaland: '13', manipur: '14',
  mizoram: '15', tripura: '16', meghalaya: '17', assam: '18', 'west bengal': '19',
  jharkhand: '20', odisha: '21', chhattisgarh: '22', 'madhya pradesh': '23',
  gujarat: '24', 'dadra and nagar haveli and daman and diu': '26', maharashtra: '27',
  'andhra pradesh': '37', karnataka: '29', goa: '30', lakshadweep: '31', kerala: '32',
  'tamil nadu': '33', puducherry: '34', 'andaman and nicobar islands': '35',
  telangana: '36', ladakh: '38',
}

// "Karnataka (29)" — the code comes from the client's GSTIN when present
// (authoritative), else from the state name. Falls back to the bare state name.
export function placeOfSupply(client: PartyLocation & { tax_id?: string | null }): string | null {
  const state = (client.state ?? '').trim()
  const gstin = (client.tax_id ?? '').trim()
  const codeFromGstin = /^\d{2}/.test(gstin) ? gstin.slice(0, 2) : null
  const code = codeFromGstin ?? STATE_CODES[norm(state)] ?? null
  if (!state && !code) return null
  return code ? `${state || 'State code'} (${code})` : state
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
