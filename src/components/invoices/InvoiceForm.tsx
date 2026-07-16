'use client'
import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { ClientPicker } from '@/components/invoices/ClientPicker'
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
  return { key, description: '', period: '', qty: '1', unit_price: '' }
}

export function InvoiceForm({ invoiceId }: { invoiceId?: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const nextKey = useRef(1)

  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<Client[]>([])
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

  useEffect(() => {
    let active = true
    async function init() {
      try {
        const [settingsRes, clientsRes, invoiceRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/clients'),
          invoiceId ? fetch(`/api/invoices/${invoiceId}`) : Promise.resolve(null),
        ])
        const settingsData = await settingsRes.json()
        const clientsData = await clientsRes.json()
        if (!active) return
        setClients(clientsData.clients ?? [])

        if (invoiceRes) {
          const invoiceData = await invoiceRes.json()
          if (!active) return
          if (invoiceData.invoice.status !== 'draft') {
            router.replace(`/invoices/${invoiceId}`)
            return
          }
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
                    unit_price: String(Number(it.unit_price)),
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
          toast('Failed to load invoice data', 'error')
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
      toast('Fix the highlighted fields', 'error')
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
    toast(d.error ?? 'Failed to save', 'error')
    return null
  }

  async function handleSaveDraft() {
    if (!validate()) return
    setSaving('draft')
    const invoice = await persist()
    setSaving(null)
    if (invoice) {
      toast('Draft saved')
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
      toast(d.error ?? 'Failed to finalize', 'error')
    }
  }

  const parsedItems = form.items.map((r) => ({ qty: Number(r.qty) || 0, unit_price: Number(r.unit_price) || 0 }))
  const taxRate = Number(form.tax_rate) || 0
  const totals = computeTotals(parsedItems, taxRate)

  return (
    <div className="flex gap-8">
      <div className="flex flex-1 flex-col gap-6">
        <Card title="Details">
          <div className="flex flex-col gap-4">
            <Field label="Client">
              <ClientPicker
                clients={clients}
                value={form.client_id}
                onChange={(id) => setForm((f) => ({ ...f, client_id: id }))}
                onClientAdded={(c) => setClients((cs) => [...cs, c])}
                error={errors.client_id}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Issue date" error={errors.issue_date}>
                <Input type="date" value={form.issue_date} onChange={set('issue_date')} />
              </Field>
              <Field label="Due date" error={errors.due_date}>
                <Input type="date" value={form.due_date} onChange={set('due_date')} />
              </Field>
              <Field label="Currency" error={errors.currency}>
                <Select value={form.currency} onChange={set('currency')}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Tax rate %" error={errors.tax_rate}>
                <Input type="number" step="0.01" min="0" max="100" value={form.tax_rate} onChange={set('tax_rate')} />
              </Field>
              <Field label="Tax label" error={errors.tax_label} className="col-span-2">
                <Input value={form.tax_label} onChange={set('tax_label')} placeholder="e.g. IGST - INDIA" />
              </Field>
            </div>
          </div>
        </Card>

        <Card title="Line items">
          <div className="flex flex-col gap-3">
            {form.items.map((row) => (
              <div key={row.key} className="grid grid-cols-12 gap-2">
                <Input
                  className="col-span-5"
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
        </Card>

        <Card title="Extras">
          <div className="flex flex-col gap-4">
            <Field label="Payment link" error={errors.payment_link}>
              <Input
                type="url"
                value={form.payment_link}
                onChange={set('payment_link')}
                placeholder="https:// … optional"
              />
            </Field>
            <Field label="Notes" error={errors.notes}>
              <Textarea value={form.notes} onChange={set('notes')} placeholder="Optional notes" />
            </Field>
          </div>
        </Card>
      </div>

      <div className="w-72 shrink-0">
        <Card className="sticky top-10 flex flex-col gap-4">
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">Subtotal</span>
              <span>{formatMoney(totals.subtotal, form.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{form.tax_label || 'Tax'} ({taxRate}%)</span>
              <span>{formatMoney(totals.taxAmount, form.currency)}</span>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold">
              <span>Total</span>
              <span>{formatMoney(totals.total, form.currency)}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button className="w-full" loading={saving === 'finalize'} onClick={handleFinalize}>
              Finalize &amp; download PDF
            </Button>
            <Button className="w-full" variant="secondary" loading={saving === 'draft'} onClick={handleSaveDraft}>
              Save draft
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
