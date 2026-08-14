import type {
  BusinessProfile,
  Client,
  ClientContact,
  Expense,
  Invoice,
  InvoiceItem,
  Project,
  TimelineEntry,
} from '@/generated/prisma/client'
import { checklistProgress, normalizeChecklist } from '@/lib/onboarding'

// Prisma row -> API response shape.
//
// WHY THIS EXISTS: the UI components were written against the Invoice app's
// snake_case JSON (`invoice.invoice_number`, `items[].unit_price`). Prisma
// returns camelCase, Decimal objects and Date objects. Rather than rewrite every
// component — which would turn a data-layer swap into a frontend rewrite and
// destroy the ability to revert Step 2 cleanly — the contract is preserved here.
//
// These mappers are also the ONLY place where:
//   * Decimal becomes number, so money.ts / gst.ts keep working in `number`
//   * Date becomes the string format the components compare and slice
//
// If a component ever renders "[object Object]" or NaN, a field is missing from
// a mapper below.

type DecimalLike = { toNumber(): number }

const n = (v: DecimalLike): number => v.toNumber()
const nOrNull = (v: DecimalLike | null): number | null => (v == null ? null : v.toNumber())

/** Postgres `date` -> 'YYYY-MM-DD'. Prisma hands these back at UTC midnight. */
const day = (d: Date): string => d.toISOString().slice(0, 10)

/** timestamptz -> ISO string, matching what the old API emitted. */
const ts = (d: Date): string => d.toISOString()
const tsOrNull = (d: Date | null): string | null => (d == null ? null : d.toISOString())

export function serializeBusinessProfile(p: BusinessProfile) {
  return {
    id: p.id,
    company_name: p.companyName,
    address_line1: p.addressLine1,
    address_line2: p.addressLine2,
    city: p.city,
    state: p.state,
    postal_code: p.postalCode,
    country: p.country,
    email: p.email,
    phone: p.phone,
    tax_id: p.taxId,
    legal_note: p.legalNote,
    bank_account_name: p.bankAccountName,
    bank_name: p.bankName,
    bank_account_number: p.bankAccountNumber,
    bank_ifsc: p.bankIfsc,
    bank_swift: p.bankSwift,
    invoice_prefix: p.invoicePrefix,
    next_invoice_number: p.nextInvoiceNumber,
    default_currency: p.defaultCurrency,
    default_tax_label: p.defaultTaxLabel,
    default_tax_rate: n(p.defaultTaxRate),
  }
}

export function serializeClient(c: Client) {
  return {
    id: c.id,
    name: c.name,
    // The UI still calls this `email`. It is Client.billingEmail now — where
    // invoices go, deliberately distinct from ClientContact (the humans who can
    // author feedback). See CLAUDE.md; do not conflate them.
    email: c.billingEmail,
    phone: c.phone,
    tax_id: c.taxId,
    address_line1: c.addressLine1,
    address_line2: c.addressLine2,
    city: c.city,
    state: c.state,
    postal_code: c.postalCode,
    country: c.country,
    archived: c.archived,
    created_at: ts(c.createdAt),
  }
}

export function serializeInvoiceItem(i: InvoiceItem) {
  return {
    id: i.id,
    invoice_id: i.invoiceId,
    description: i.description,
    period: i.period,
    qty: n(i.qty),
    unit_price: n(i.unitPrice),
    gst_included: i.gstIncluded,
    entered_unit_price: nOrNull(i.enteredUnitPrice),
    amount: n(i.amount),
    sort_order: i.sortOrder,
  }
}

export function serializeInvoice(inv: Invoice) {
  return {
    id: inv.id,
    invoice_number: inv.invoiceNumber,
    client_id: inv.clientId,
    project_id: inv.projectId,
    issue_date: day(inv.issueDate),
    due_date: day(inv.dueDate),
    status: inv.status,
    currency: inv.currency,
    tax_label: inv.taxLabel,
    tax_rate: n(inv.taxRate),
    payment_link: inv.paymentLink,
    notes: inv.notes,
    business_snapshot: inv.businessSnapshot,
    client_snapshot: inv.clientSnapshot,
    subtotal: n(inv.subtotal),
    tax_amount: n(inv.taxAmount),
    total: n(inv.total),
    paid_at: tsOrNull(inv.paidAt),
    amount_received: nOrNull(inv.amountReceived),
    tds_amount: n(inv.tdsAmount),
    payment_reference: inv.paymentReference,
    created_at: ts(inv.createdAt),
    updated_at: ts(inv.updatedAt),
  }
}

/** The lighter shape the invoice list renders, including the joined client name. */
export function serializeInvoiceListRow(
  inv: Pick<
    Invoice,
    | 'id'
    | 'invoiceNumber'
    | 'issueDate'
    | 'dueDate'
    | 'status'
    | 'currency'
    | 'total'
    | 'createdAt'
    | 'updatedAt'
  > & { client: { name: string } | null },
) {
  return {
    id: inv.id,
    invoice_number: inv.invoiceNumber,
    issue_date: day(inv.issueDate),
    due_date: day(inv.dueDate),
    status: inv.status,
    currency: inv.currency,
    total: n(inv.total),
    created_at: ts(inv.createdAt),
    updated_at: ts(inv.updatedAt),
    // Supabase's join emitted `clients` (the table name). Keep the key.
    clients: inv.client ? { name: inv.client.name } : null,
  }
}

/**
 * A timeline entry with its author resolved.
 *
 * `authorUser` is selected for internal entries only. It carries an email, so
 * this serializer must never be reachable from the client surface — client
 * reads go through lib/client-scope.ts, which doesn't select it at all.
 */
export function serializeTimelineEntry(
  e: TimelineEntry & {
    authorUser?: { id: string; name: string | null; email: string } | null
    authorContact?: { id: string; name: string } | null
  },
) {
  return {
    id: e.id,
    project_id: e.projectId,
    kind: e.kind,
    author_type: e.authorType,
    author: e.authorUser
      ? { kind: 'internal' as const, name: e.authorUser.name ?? e.authorUser.email }
      : e.authorContact
        ? { kind: 'client' as const, name: e.authorContact.name }
        : { kind: 'system' as const, name: 'Weft' },
    body: e.body,
    created_at: ts(e.createdAt),
  }
}

export function serializeProject(p: Project) {
  // The stored JSON is normalised on the way out, so a project created before a
  // checklist step existed still reports the full list, and the UI never has to
  // cope with a malformed column.
  const onboarding = normalizeChecklist(p.onboarding)
  return {
    id: p.id,
    client_id: p.clientId,
    name: p.name,
    slug: p.slug,
    status: p.status,
    onboarding,
    onboarding_progress: checklistProgress(onboarding),
    created_at: ts(p.createdAt),
    updated_at: ts(p.updatedAt),
    archived_at: tsOrNull(p.archivedAt),
  }
}

export function serializeClientContact(c: ClientContact) {
  return {
    id: c.id,
    client_id: c.clientId,
    name: c.name,
    email: c.email,
    title: c.title,
    active: c.active,
    created_at: ts(c.createdAt),
  }
}

export function serializeExpense(e: Expense) {
  return {
    id: e.id,
    name: e.name,
    expense_type: e.expenseType,
    amount: n(e.amount),
    currency: e.currency,
    payer_type: e.payerType,
    payer_name: e.payerName,
    expense_date: day(e.expenseDate),
    note: e.note,
    created_at: ts(e.createdAt),
  }
}
