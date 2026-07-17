import path from 'node:path'
import { readFileSync } from 'node:fs'
import { Document, Font, Image, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { formatMoney } from '@/lib/money'
import { formatDateLong } from '@/lib/dates'

const fontsDir = path.join(process.cwd(), 'src/lib/pdf/fonts')
// Buffer src: a bare Windows path ("C:\...") is misparsed as a URL by react-pdf's
// image loader, so the logo must be handed over as bytes, not a path.
const logoSrc = { data: readFileSync(path.join(process.cwd(), 'public/logo.png')), format: 'png' as const }
Font.register({
  family: 'Inter',
  fonts: [
    { src: path.join(fontsDir, 'Inter_400Regular.ttf'), fontWeight: 400 },
    { src: path.join(fontsDir, 'Inter_500Medium.ttf'), fontWeight: 500 },
    { src: path.join(fontsDir, 'Inter_600SemiBold.ttf'), fontWeight: 600 },
    { src: path.join(fontsDir, 'Inter_700Bold.ttf'), fontWeight: 700 },
  ],
})

export interface PdfParty {
  company_name?: string
  name?: string
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  email: string | null
  phone?: string | null
  tax_id: string | null
  legal_note?: string | null
  bank_account_name?: string | null
  bank_name?: string | null
  bank_account_number?: string | null
  bank_ifsc?: string | null
}

export interface InvoicePdfData {
  number: string
  issueDate: string
  dueDate: string
  business: PdfParty
  client: PdfParty
  currency: string
  taxLabel: string | null
  taxRate: number
  paymentLink: string | null
  notes: string | null
  items: { description: string; period: string | null; qty: number; unitPrice: number; amount: number }[]
  subtotal: number
  taxAmount: number
  total: number
  cancelled?: boolean
}

const s = StyleSheet.create({
  page: { fontFamily: 'Inter', fontSize: 9, color: '#18181b', paddingTop: 40, paddingHorizontal: 44, paddingBottom: 48 },
  title: { fontSize: 22, fontWeight: 700, letterSpacing: -0.3 },
  logo: { width: 120 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  metaTable: { marginTop: 14, gap: 3 },
  metaRow: { flexDirection: 'row' },
  metaLabel: { width: 90, fontWeight: 600 },
  parties: { flexDirection: 'row', marginTop: 26, gap: 60 },
  party: { width: 220, gap: 2.5 },
  partyName: { fontWeight: 600, marginBottom: 2 },
  billToLabel: { fontWeight: 600, marginBottom: 2 },
  banner: { marginTop: 30, fontSize: 15, fontWeight: 600, letterSpacing: -0.2 },
  payLink: { marginTop: 10, color: '#4353ff', textDecoration: 'underline' },
  legal: { marginTop: 6, gap: 2.5, color: '#3f3f46' },
  table: { marginTop: 26 },
  thead: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#18181b', paddingBottom: 5, color: '#52525b' },
  tr: { flexDirection: 'row', paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: '#e4e4e7' },
  colDesc: { flex: 1, paddingRight: 8 },
  colQty: { width: 40, textAlign: 'right' },
  colPrice: { width: 70, textAlign: 'right' },
  colTax: { width: 50, textAlign: 'right' },
  colAmount: { width: 80, textAlign: 'right' },
  period: { color: '#71717a', marginTop: 2 },
  totals: { marginTop: 4, alignSelf: 'flex-end', width: 260 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: '#e4e4e7' },
  totalStrong: { fontWeight: 700 },
  bank: { marginTop: 34, gap: 2.5 },
  bankTitle: { fontWeight: 600, marginBottom: 2 },
  bankRow: { flexDirection: 'row' },
  bankLabel: { width: 130, color: '#52525b' },
  notes: { marginTop: 22, color: '#3f3f46' },
  footer: { position: 'absolute', bottom: 24, left: 44, right: 44, borderTopWidth: 0.5, borderTopColor: '#e4e4e7', paddingTop: 8, color: '#71717a', fontSize: 8, textAlign: 'right' },
})

function partyLines(p: PdfParty): string[] {
  const cityLine = [p.city, p.postal_code].filter(Boolean).join(' ')
  return [p.address_line1, p.address_line2, cityLine, p.state, p.country, p.email, p.phone]
    .filter((x): x is string => Boolean(x && x.trim()))
}

export function InvoicePdf({ data }: { data: InvoicePdfData }) {
  const fm = (n: number) => formatMoney(n, data.currency)
  const bank: [string, string | null | undefined][] = [
    ['Account holder', data.business.bank_account_name],
    ['Bank', data.business.bank_name],
    ['Account number', data.business.bank_account_number],
    ['IFSC', data.business.bank_ifsc],
  ]
  const hasBank = bank.some(([, v]) => v)

  return (
    <Document title={`Invoice ${data.number}`}>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <Text style={s.title}>Invoice</Text>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image style={s.logo} src={logoSrc} />
        </View>

        <View style={s.metaTable}>
          <View style={s.metaRow}><Text style={s.metaLabel}>Invoice number</Text><Text>{data.number}</Text></View>
          <View style={s.metaRow}><Text style={s.metaLabel}>Date of issue</Text><Text>{formatDateLong(data.issueDate)}</Text></View>
          <View style={s.metaRow}><Text style={s.metaLabel}>Date due</Text><Text>{formatDateLong(data.dueDate)}</Text></View>
          {data.cancelled && (
            <View style={s.metaRow}><Text style={s.metaLabel}>Status</Text><Text style={{ fontWeight: 700 }}>CANCELLED</Text></View>
          )}
        </View>

        <View style={s.parties}>
          <View style={s.party}>
            <Text style={s.partyName}>{data.business.company_name}</Text>
            {partyLines(data.business).map((l, i) => <Text key={i}>{l}</Text>)}
            {/* {data.business.tax_id && <Text>GSTIN : {data.business.tax_id}</Text>} */}
          </View>
          <View style={s.party}>
            <Text style={s.billToLabel}>Bill to</Text>
            <Text>{data.client.name}</Text>
            {partyLines(data.client).map((l, i) => <Text key={i}>{l}</Text>)}
            {data.client.tax_id && <Text>GSTIN : {data.client.tax_id}</Text>}
          </View>
        </View>

        <Text style={s.banner}>
          {fm(data.total)} {data.currency}
          {/* {fm(data.total)} {data.currency} due {formatDateLong(data.dueDate)} */}
        </Text>
        {data.paymentLink && <Link style={s.payLink} src={data.paymentLink}>Pay online</Link>}

        {(data.business.tax_id || data.business.legal_note) && (
          <View style={s.legal}>
            {data.business.tax_id && <Text>{data.business.company_name} GSTIN : {data.business.tax_id}</Text>}
            {/* {data.business.tax_id && <Text>GSTIN : {data.business.tax_id}</Text>} */}
            {data.business.legal_note && <Text>{data.business.legal_note}</Text>}
          </View>
        )}

        <View style={s.table}>
          <View style={s.thead}>
            <Text style={s.colDesc}>Description</Text>
            <Text style={s.colQty}>Qty</Text>
            <Text style={s.colPrice}>Unit price</Text>
            <Text style={s.colTax}>Tax</Text>
            <Text style={s.colAmount}>Amount</Text>
          </View>
          {data.items.map((it, i) => (
            <View key={i} style={s.tr}>
              <View style={s.colDesc}>
                <Text style={{ fontWeight: 500 }}>{it.description}</Text>
                {it.period && <Text style={s.period}>{it.period}</Text>}
              </View>
              <Text style={s.colQty}>{it.qty}</Text>
              <Text style={s.colPrice}>{fm(it.unitPrice)}</Text>
              <Text style={s.colTax}>{data.taxRate > 0 ? `${data.taxRate}%` : '—'}</Text>
              <Text style={s.colAmount}>{fm(it.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totals}>
          <View style={s.totalRow}><Text>Subtotal</Text><Text>{fm(data.subtotal)}</Text></View>
          <View style={s.totalRow}><Text>Total excluding tax</Text><Text>{fm(data.subtotal)}</Text></View>
          {data.taxRate > 0 && (
            <View style={s.totalRow}>
              <Text>{data.taxLabel || 'Tax'} ({data.taxRate}% on {fm(data.subtotal)})</Text>
              <Text>{fm(data.taxAmount)}</Text>
            </View>
          )}
          <View style={s.totalRow}><Text>Total</Text><Text>{fm(data.total)}</Text></View>
          <View style={[s.totalRow, { borderBottomWidth: 0 }]}>
            <Text style={s.totalStrong}>Amount due</Text>
            <Text style={s.totalStrong}>{fm(data.total)} {data.currency}</Text>
          </View>
        </View>

        {hasBank && (
          <View style={s.bank}>
            <Text style={s.bankTitle}>Payment details</Text>
            {bank.filter(([, v]) => v).map(([label, v]) => (
              <View key={label} style={s.bankRow}>
                <Text style={s.bankLabel}>{label}</Text>
                <Text>{v}</Text>
              </View>
            ))}
          </View>
        )}

        {data.notes && <Text style={s.notes}>{data.notes}</Text>}

        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  )
}
