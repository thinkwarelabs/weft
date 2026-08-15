'use client'
import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select-field'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { ClientPicker } from '@/components/invoices/ClientPicker'
import { gstBreakdown, isIntraState } from '@/lib/gst'
import { computeTotals, formatMoney } from '@/lib/money'
import { todayISO } from '@/lib/dates'
import { BusinessProfile, Client, Invoice, InvoiceItem } from '@/lib/types'

const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'AED', 'AUD', 'CAD', 'SGD']

interface ItemRow {
  key: number
  description: string
  period: string
  qty: string
  unit_price: string
  gst_included: boolean
}

interface FormState {
  client_id: string
  issue_date: string
  due_date: string
  currency: string
  tax_label: string
  tax_rate: string
  payment_link: string
  notes: string
  items: ItemRow[]
}

function makeRow(key: number): ItemRow {
  return { key, description: '', period: '', qty: '1', unit_price: '', gst_included: true }
}

export function InvoiceForm({ invoiceId }: { invoiceId?: string }) {
  const router = useRouter()
  const nextKey = useRef(1)

  const [loading, setLoading] = useState(true)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [form, setForm] = useState<FormState>({
    client_id: '',
    issue_date: todayISO(),
    due_date: todayISO(),
    currency: 'USD',
    tax_label: '',
    tax_rate: '0',
    payment_link: '',
    notes: '',
    items: [makeRow(0)],
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<'draft' | 'finalize' | null>(null)
  const [businessLoc, setBusinessLoc] = useState<{ state: string; country: string }>({ state: '', country: '' })

  useEffect(() => {
    let active = true
    async function init() {
      try {
        const [settingsRes, invoiceRes] = await Promise.all([
          fetch('/api/settings'),
          invoiceId ? fetch(`/api/invoices/${invoiceId}`) : Promise.resolve(null),
        ])
        const settingsData = await settingsRes.json()
        if (!active) return
        setBusinessLoc({
          state: settingsData.profile?.state ?? '',
          country: settingsData.profile?.country ?? '',
        })

        if (invoiceRes) {
          const invoiceData = await invoiceRes.json()
          if (!active) return
          if (invoiceData.invoice.status !== 'draft') {
            router.replace(`/invoices/${invoiceId}`)
            return
          }
          setSelectedClient(invoiceData.client ?? null)
          const items: InvoiceItem[] = invoiceData.items ?? []
          setForm({
            client_id: invoiceData.invoice.client_id,
            issue_date: invoiceData.invoice.issue_date,
            due_date: invoiceData.invoice.due_date,
            currency: invoiceData.invoice.currency,
            tax_label: invoiceData.invoice.tax_label ?? '',
            tax_rate: String(invoiceData.invoice.tax_rate),
            payment_link: invoiceData.invoice.payment_link ?? '',
            notes: invoiceData.invoice.notes ?? '',
            items:
              items.length > 0
                ? items.map((it) => ({
                    key: nextKey.current++,
                    description: it.description,
                    period: it.period ?? '',
                    qty: String(Number(it.qty)),
                    unit_price: String(Number(it.entered_unit_price ?? it.unit_price)),
                    gst_included: Boolean(it.gst_included),
                  }))
                : [makeRow(nextKey.current++)],
          })
        } else {
          const profile: BusinessProfile = settingsData.profile
          setForm((f) => ({
            ...f,
            currency: profile.default_currency,
            tax_label: profile.default_tax_label ?? '',
            tax_rate: String(profile.default_tax_rate),
          }))
        }
        setLoading(false)
      } catch {
        if (active) {
          toast.error('Failed to load invoice data')
          setLoading(false)
        }
      }
    }
    init()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="size-10 text-zinc-400" />
      </div>
    )
  }

  const set = (key: keyof FormState) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  function updateItem(key: number, patch: Partial<ItemRow>) {
    setForm((f) => ({ ...f, items: f.items.map((r) => (r.key === key ? { ...r, ...patch } : r)) }))
  }

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, makeRow(nextKey.current++)] }))
  }

  function removeItem(key: number) {
    setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((r) => r.key !== key) : f.items }))
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.client_id) errs.client_id = 'Select a client'
    if (!form.issue_date) errs.issue_date = 'Required'
    if (!form.due_date) errs.due_date = 'Required'
    const included = form.items.filter((r) => r.description.trim())
    if (included.length === 0) {
      errs.items = 'Add at least one item'
    } else if (
      included.some((r) => !(Number(r.qty) > 0) || r.unit_price.trim() === '' || !(Number(r.unit_price) >= 0))
    ) {
      errs.items = 'Every item needs a qty > 0 and a unit price'
    }
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      toast.error('Fix the highlighted fields')
      return false
    }
    return true
  }

  function payload() {
    return {
      client_id: form.client_id,
      issue_date: form.issue_date,
      due_date: form.due_date,
      currency: form.currency,
      tax_label: form.tax_label.trim(),
      tax_rate: Number(form.tax_rate) || 0,
      payment_link: form.payment_link.trim(),
      notes: form.notes.trim(),
      items: form.items
        .filter((r) => r.description.trim())
        .map((r) => ({
          description: r.description.trim(),
          period: r.period.trim(),
          qty: Number(r.qty),
          unit_price: Number(r.unit_price),
          gst_included: r.gst_included,
        })),
    }
  }

  async function persist(): Promise<Invoice | null> {
    const res = await fetch(invoiceId ? `/api/invoices/${invoiceId}` : '/api/invoices', {
      method: invoiceId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload()),
    })
    if (res.ok) {
      const d = await res.json()
      return d.invoice as Invoice
    }
    const d = await res.json().catch(() => ({}))
    if (d.issues) {
      setErrors((e) => ({
        ...e,
        ...Object.fromEntries(Object.entries(d.issues).map(([k, v]) => [k, (v as string[])[0]])),
      }))
    }
    toast.error(d.error ?? 'Failed to save')
    return null
  }

  async function handleSaveDraft() {
    if (!validate()) return
    setSaving('draft')
    const invoice = await persist()
    setSaving(null)
    if (invoice) {
      toast.success('Draft saved')
      router.push(`/invoices/${invoice.id}`)
    }
  }

  async function handleFinalize() {
    if (!validate()) return
    setSaving('finalize')
    const invoice = await persist()
    if (!invoice) {
      setSaving(null)
      return
    }
    const res = await fetch(`/api/invoices/${invoice.id}/finalize`, { method: 'POST' })
    setSaving(null)
    if (res.ok) {
      router.push(`/invoices/${invoice.id}?autodownload=1`)
    } else {
      const d = await res.json().catch(() => ({}))
      toast.error(d.error ?? 'Failed to finalize')
    }
  }

  const taxRate = Number(form.tax_rate) || 0
  const parsedItems = form.items.map((r) => ({
    qty: Number(r.qty) || 0,
    unit_price: Number(r.unit_price) || 0,
    gst_included: r.gst_included,
  }))
  const totals = computeTotals(parsedItems, taxRate)
  const gstRows = gstBreakdown(taxRate, totals.taxAmount, selectedClient ? isIntraState(businessLoc, selectedClient) : false)

  return (
    <div className="flex gap-8">
      <div className="flex flex-1 flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <Field label="Client">
                <ClientPicker
                  selected={selectedClient}
                  onSelect={(c) => {
                    setSelectedClient(c)
                    setForm((f) => ({ ...f, client_id: c.id }))
                  }}
                  error={errors.client_id}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Issue date" error={errors.issue_date}>
                  <DatePicker value={form.issue_date} onChange={(d) => setForm((f) => ({ ...f, issue_date: d }))} />
                </Field>
                <Field label="Due date" error={errors.due_date}>
                  <DatePicker value={form.due_date} onChange={(d) => setForm((f) => ({ ...f, due_date: d }))} />
                </Field>
                <Field label="Currency" error={errors.currency}>
                  <Select
                    value={form.currency}
                    onChange={(v) => setForm((f) => ({ ...f, currency: v }))}
                    options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                  />
                </Field>
                <Field label="Tax rate %" error={errors.tax_rate}>
                  <Input type="number" step="0.01" min="0" max="100" value={form.tax_rate} onChange={set('tax_rate')} />
                </Field>
                <Field label="Tax label" error={errors.tax_label} className="col-span-2">
                  <Input value={form.tax_label} onChange={set('tax_label')} placeholder="e.g. IGST - INDIA" />
                </Field>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Line items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-12 gap-2 text-[13px] font-medium text-zinc-500">
                <span className="col-span-4">Description</span>
                <span className="col-span-3">Period</span>
                <span className="col-span-1">Qty</span>
                <span className="col-span-2">Unit price</span>
                <span className="col-span-1 text-center" title="Unit price includes GST">GST incl.</span>
                <span className="col-span-1" />
              </div>
              {form.items.map((row) => (
                <div key={row.key} className="grid grid-cols-12 gap-2">
                  <Input
                    className="col-span-4"
                    placeholder="Description"
                    value={row.description}
                    onChange={(e) => updateItem(row.key, { description: e.target.value })}
                  />
                  <Input
                    className="col-span-3"
                    placeholder="e.g. Jul 10–Aug 9, 2026"
                    value={row.period}
                    onChange={(e) => updateItem(row.key, { period: e.target.value })}
                  />
                  <Input
                    className="col-span-1"
                    type="number"
                    value={row.qty}
                    onChange={(e) => updateItem(row.key, { qty: e.target.value })}
                  />
                  <Input
                    className="col-span-2"
                    type="number"
                    value={row.unit_price}
                    onChange={(e) => updateItem(row.key, { unit_price: e.target.value })}
                  />
                  <label className="col-span-1 flex cursor-pointer items-center justify-center" title="Unit price includes GST">
                    <input
                      type="checkbox"
                      className="size-4 cursor-pointer accent-zinc-900"
                      checked={row.gst_included}
                      onChange={(e) => updateItem(row.key, { gst_included: e.target.checked })}
                      aria-label="Unit price includes GST"
                    />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    className="col-span-1 justify-self-center px-2"
                    onClick={() => removeItem(row.key)}
                    disabled={form.items.length === 1}
                  >
                    ×
                  </Button>
                </div>
              ))}
              {errors.items && <span className="block text-xs text-red-600">{errors.items}</span>}
              <Button type="button" variant="ghost" className="self-start" onClick={addItem}>
                + Add item
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Extras</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <Field label="Payment link (optional)" error={errors.payment_link}>
                <Input
                  type="url"
                  value={form.payment_link}
                  onChange={set('payment_link')}
                  placeholder="https://…"
                />
              </Field>
              <Field label="Notes (optional)" error={errors.notes}>
                <Textarea value={form.notes} onChange={set('notes')} placeholder="Anything the client should see on the invoice" />
              </Field>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="w-72 shrink-0">
        <Card className="sticky top-10 flex flex-col gap-4">
          <CardContent>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Subtotal</span>
                <span>{formatMoney(totals.subtotal, form.currency)}</span>
              </div>
              {gstRows.length > 0 ? (
                gstRows.map((r) => (
                  <div key={r.label} className="flex justify-between">
                    <span className="text-zinc-500">{r.label} ({r.rate}%)</span>
                    <span>{formatMoney(r.amount, form.currency)}</span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between">
                  <span className="text-zinc-500">{form.tax_label || 'Tax'} ({taxRate}%)</span>
                  <span>{formatMoney(totals.taxAmount, form.currency)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold">
                <span>Total</span>
                <span>{formatMoney(totals.total, form.currency)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button className="w-full" loading={saving === 'finalize'} onClick={handleFinalize}>
                Finalize &amp; download PDF
              </Button>
              <Button className="w-full" variant="outline" loading={saving === 'draft'} onClick={handleSaveDraft}>
                Save draft
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
