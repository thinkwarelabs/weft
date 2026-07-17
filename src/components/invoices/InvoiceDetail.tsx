'use client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { formatDateLong } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { daysOverdue, isOverdue } from '@/lib/overdue'
import { Client, Invoice } from '@/lib/types'
import { RecordPaymentModal } from './RecordPaymentModal'

const CONFIRM_CONFIG = {
  void: {
    title: 'Void this invoice?',
    message: 'The number stays used. Voided invoices are excluded from outstanding amounts and financials.',
    confirmLabel: 'Void invoice',
    danger: true,
    path: 'void',
    successMsg: 'Invoice voided',
  },
  restore: {
    title: 'Restore this invoice?',
    message: 'The invoice becomes finalized again and counts toward outstanding amounts.',
    confirmLabel: 'Restore invoice',
    danger: false,
    path: 'unvoid',
    successMsg: 'Invoice restored',
  },
  undo: {
    title: 'Undo this payment?',
    message: 'The invoice returns to finalized and its payment details are cleared.',
    confirmLabel: 'Undo payment',
    danger: false,
    path: 'unmark-paid',
    successMsg: 'Payment undone',
  },
} as const

type ConfirmAction = keyof typeof CONFIRM_CONFIG

export function InvoiceDetail({ id }: { id: string }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState<'finalize' | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const downloaded = useRef(false)

  const pdfUrl = `/api/invoices/${id}/pdf`

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setInvoice(d.invoice); setClient(d.client) })
      .catch(() => setNotFound(true))
  }, [id])

  // auto-download once for freshly finalized invoices
  useEffect(() => {
    if (searchParams.get('autodownload') === '1' && !downloaded.current) {
      downloaded.current = true
      const a = document.createElement('a')
      a.href = `${pdfUrl}?download=1`
      document.body.appendChild(a)
      a.click()
      a.remove()
      router.replace(`/invoices/${id}`, { scroll: false })
    }
  }, [searchParams, pdfUrl, id, router])

  if (notFound) return <p className="py-20 text-center text-sm text-zinc-500">Invoice not found.</p>
  if (!invoice) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner className="size-10 text-zinc-400" /></div>

  async function finalize() {
    setBusy('finalize')
    const res = await fetch(`/api/invoices/${id}/finalize`, { method: 'POST' })
    setBusy(null)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) return toast(d.error ?? 'Something went wrong', 'error')
    setInvoice(d.invoice)
    toast(`Invoice ${d.invoice.invoice_number} finalized`)
    const a = document.createElement('a')
    a.href = `${pdfUrl}?download=1`
    document.body.appendChild(a); a.click(); a.remove()
  }

  async function runConfirmedAction(path: string, successMsg: string) {
    const res = await fetch(`/api/invoices/${id}/${path}`, { method: 'POST' })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) return toast(d.error ?? 'Something went wrong', 'error')
    setInvoice(d.invoice)
    toast(successMsg)
  }

  const overdue = isOverdue(invoice.status, invoice.due_date)
  const cfg = confirmAction ? CONFIRM_CONFIG[confirmAction] : null

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{invoice.invoice_number ?? 'Draft invoice'}</h1>
            {overdue ? (
              <Badge status="overdue" label={`Overdue · ${daysOverdue(invoice.due_date)}d`} />
            ) : (
              <Badge status={invoice.status} />
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {client?.name} · {formatMoney(Number(invoice.total), invoice.currency)} · due {formatDateLong(invoice.due_date)}
            {overdue && <span className="text-red-600"> · Overdue · {daysOverdue(invoice.due_date)}d</span>}
          </p>
          {invoice.status === 'paid' && invoice.paid_at && (
            <p className="mt-1 text-sm text-zinc-600">
              Received {formatMoney(Number(invoice.amount_received), invoice.currency)} · TDS{' '}
              {formatMoney(Number(invoice.tds_amount), invoice.currency)} · {formatDateLong(invoice.paid_at.slice(0, 10))}
              {invoice.payment_reference && ` · Ref ${invoice.payment_reference}`}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {invoice.status === 'draft' && (
            <>
              <Link href={`/invoices/${id}/edit`}><Button variant="secondary">Edit</Button></Link>
              <Button loading={busy === 'finalize'} onClick={finalize}>Finalize</Button>
            </>
          )}
          {invoice.status === 'finalized' && (
            <>
              <Button variant="danger" onClick={() => setConfirmAction('void')}>Void</Button>
              <Button variant="primary" onClick={() => setPaymentModalOpen(true)}>Record payment</Button>
            </>
          )}
          {invoice.status === 'paid' && (
            <Button variant="secondary" onClick={() => setConfirmAction('undo')}>Undo payment</Button>
          )}
          {invoice.status === 'cancelled' && (
            <Button variant="secondary" onClick={() => setConfirmAction('restore')}>Restore invoice</Button>
          )}
          <a href={`${pdfUrl}?download=1`}><Button>Download PDF</Button></a>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <iframe
          key={invoice.status} // re-render preview after finalize (number appears)
          src={`${pdfUrl}#toolbar=0&navpanes=0`}
          className="h-[75vh] w-full"
          title="Invoice PDF preview"
        />
      </div>

      {cfg && (
        <ConfirmDialog
          open={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => runConfirmedAction(cfg.path, cfg.successMsg)}
          title={cfg.title}
          message={cfg.message}
          confirmLabel={cfg.confirmLabel}
          danger={cfg.danger}
        />
      )}

      {invoice.status === 'finalized' && (
        <RecordPaymentModal
          invoice={{
            id: invoice.id,
            invoice_number: invoice.invoice_number,
            total: Number(invoice.total),
            currency: invoice.currency,
          }}
          open={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          onSaved={(inv) => {
            setInvoice(inv)
            setPaymentModalOpen(false)
          }}
        />
      )}
    </div>
  )
}
