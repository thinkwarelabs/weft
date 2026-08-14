export type InvoiceStatus = 'draft' | 'finalized' | 'paid' | 'cancelled'

export interface BusinessProfile {
  id: number
  company_name: string
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  email: string | null
  phone: string | null
  tax_id: string | null
  legal_note: string | null
  bank_account_name: string | null
  bank_name: string | null
  bank_account_number: string | null
  bank_ifsc: string | null
  bank_swift: string | null
  invoice_prefix: string
  next_invoice_number: number
  default_currency: string
  default_tax_label: string | null
  default_tax_rate: number
}

export interface Client {
  id: string
  name: string
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  email: string | null
  phone: string | null
  tax_id: string | null
  archived: boolean
  created_at: string
}

export type ProjectStatus = 'onboarding' | 'active' | 'paused' | 'closed'

export interface ChecklistItemDto {
  key: string
  label: string
  doneAt: string | null
  doneByUserId: string | null
}

export interface Project {
  id: string
  client_id: string
  name: string
  slug: string
  status: ProjectStatus
  onboarding: ChecklistItemDto[]
  onboarding_progress: { done: number; total: number; complete: boolean; percent: number }
  created_at: string
  updated_at: string
  archived_at: string | null
}

/** A named human at a client — can be sent a feedback link. Not the billing email. */
export interface ClientContact {
  id: string
  client_id: string
  name: string
  email: string
  title: string | null
  active: boolean
  created_at: string
}

export type EntryKind = 'note' | 'feedback' | 'milestone' | 'status_change'

export interface TimelineEntry {
  id: string
  project_id: string
  kind: EntryKind
  author_type: 'internal' | 'client'
  author: { kind: 'internal' | 'client' | 'system'; name: string }
  body: string
  created_at: string
}

export interface Invoice {
  id: string
  invoice_number: string | null
  client_id: string
  issue_date: string
  due_date: string
  status: InvoiceStatus
  currency: string
  tax_label: string | null
  tax_rate: number
  payment_link: string | null
  notes: string | null
  business_snapshot: BusinessProfile | null
  client_snapshot: Client | null
  subtotal: number
  tax_amount: number
  total: number
  paid_at: string | null
  amount_received: number | null
  tds_amount: number
  payment_reference: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  description: string
  period: string | null
  qty: number
  unit_price: number
  gst_included: boolean
  entered_unit_price: number | null
  amount: number
  sort_order: number
}

export interface Expense {
  id: string
  name: string
  expense_type: string | null
  amount: number
  currency: string
  payer_type: 'company' | 'person'
  payer_name: string | null
  expense_date: string
  note: string | null
  created_at: string
}

export interface InvoiceListRow {
  id: string
  invoice_number: string | null
  issue_date: string
  due_date: string
  status: InvoiceStatus
  currency: string
  total: number
  created_at: string
  updated_at: string
  clients: { name: string } | null
}

export type { ClientInput, ExpenseInput, InvoiceInput, InvoiceItemInput, PaymentInput, SettingsInput } from './validation'
