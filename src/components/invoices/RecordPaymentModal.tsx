'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/legacy/DatePicker'
import { Field } from '@/components/legacy/Field'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/legacy/Modal'
import { useToast } from '@/components/legacy/Toast'
import { todayISO } from '@/lib/dates'
import { formatMoney, round2 } from '@/lib/money'
import { Invoice } from '@/lib/types'

interface PaymentInvoice {
  id: string
  invoice_number: string | null
  total: number
  currency: string
}

export function RecordPaymentModal({ invoice, open, onClose, onSaved }: {
  invoice: PaymentInvoice
  open: boolean
  onClose: () => void
  onSaved: (inv: Invoice) => void
}) {
  // No reset effect. The parent renders this only while open and keys it by the
  // record being edited, so opening the form mounts a fresh component and these
  // initialisers run again. Syncing props into state inside an effect causes the
  // cascading render the react-hooks rule warns about, and leaves stale edits
  // visible for one frame after reopening.
  const [paymentDate, setPaymentDate] = useState(todayISO)
  const [tds, setTds] = useState('0')
  const [received, setReceived] = useState(String(invoice.total))
  const [reference, setReference] = useState('')
  const [receivedTouched, setReceivedTouched] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  function onTdsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setTds(value)
    if (!receivedTouched) {
      const tdsNum = Number(value) || 0
      setReceived(String(round2(invoice.total - tdsNum)))
    }
  }

  function onReceivedChange(e: React.ChangeEvent<HTMLInputElement>) {
    setReceivedTouched(true)
    setReceived(e.target.value)
  }

  const receivedNum = Number(received) || 0
  const tdsNum = Number(tds) || 0
  const balanced = round2(receivedNum + tdsNum) === round2(invoice.total)
  const mismatchMsg = `Received + TDS must equal ${formatMoney(invoice.total, invoice.currency)}`
  const receivedError = errors.amount_received ?? (!balanced ? mismatchMsg : undefined)

  async function save() {
    if (!balanced) {
      setErrors((e) => ({ ...e, amount_received: mismatchMsg }))
      return
    }
    setErrors({})
    setSaving(true)
    const res = await fetch(`/api/invoices/${invoice.id}/mark-paid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_date: paymentDate,
        amount_received: receivedNum,
        tds_amount: tdsNum,
        payment_reference: reference,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const d = await res.json()
      onSaved(d.invoice)
      onClose()
      toast('Payment recorded')
    } else {
      const d = await res.json().catch(() => ({}))
      if (d.issues) setErrors(Object.fromEntries(Object.entries(d.issues).map(([k, v]) => [k, (v as string[])[0]])))
      toast(d.error ?? 'Failed to record payment', 'error')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Record payment${invoice.invoice_number ? ` · ${invoice.invoice_number}` : ''}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button loading={saving} onClick={save}>Save</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Payment date" error={errors.payment_date}>
          <DatePicker value={paymentDate} onChange={setPaymentDate} />
        </Field>
        <Field label="Reference" error={errors.payment_reference}>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / transaction ref" />
        </Field>
        <Field label="TDS amount" error={errors.tds_amount}>
          <Input type="number" min="0" step="0.01" value={tds} onChange={onTdsChange} />
        </Field>
        <Field label="Amount received" error={receivedError}>
          <Input type="number" min="0" step="0.01" value={received} onChange={onReceivedChange} />
        </Field>
      </div>
      <p className="mt-4 text-sm text-zinc-600">
        {formatMoney(receivedNum, invoice.currency)} + {formatMoney(tdsNum, invoice.currency)} TDS = {formatMoney(invoice.total, invoice.currency)}
      </p>
    </Modal>
  )
}
