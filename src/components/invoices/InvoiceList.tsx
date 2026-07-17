'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { formatDateLong } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { daysOverdue, isOverdue } from '@/lib/overdue'
import { InvoiceListRow } from '@/lib/types'
import { RecordPaymentModal } from './RecordPaymentModal'

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'finalized', label: 'Finalized' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'paid', label: 'Paid' },
  { key: 'cancelled', label: 'Cancelled' },
] as const

type StatusFilter = (typeof TABS)[number]['key']

function sumByCurrency(rows: InvoiceListRow[]): string {
  const sums = new Map<string, number>()
  for (const r of rows) sums.set(r.currency, (sums.get(r.currency) ?? 0) + Number(r.total))
  if (sums.size === 0) return '—'
  return [...sums.entries()].map(([c, n]) => formatMoney(n, c)).join(' · ')
}

export function InvoiceList() {
  const [invoices, setInvoices] = useState<InvoiceListRow[] | null>(null)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [confirmDelete, setConfirmDelete] = useState<InvoiceListRow | null>(null)
  const [payingRow, setPayingRow] = useState<InvoiceListRow | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/invoices')
      .then((r) => r.json())
      .then((d) => setInvoices(d.invoices))
      .catch(() => toast('Failed to load invoices', 'error'))
  }, [toast])

  const outstandingRows = useMemo(() => (invoices ?? []).filter((r) => r.status === 'finalized'), [invoices])
  const overdueRows = useMemo(
    () => (invoices ?? []).filter((r) => isOverdue(r.status, r.due_date)),
    [invoices]
  )
  const outstanding = useMemo(() => sumByCurrency(outstandingRows), [outstandingRows])
  const overdueSum = useMemo(() => sumByCurrency(overdueRows), [overdueRows])
  const paidThisMonth = useMemo(() => {
    const now = new Date()
    return sumByCurrency(
      (invoices ?? []).filter((r) => {
        if (r.status !== 'paid') return false
        const updated = new Date(r.updated_at)
        return updated.getFullYear() === now.getFullYear() && updated.getMonth() === now.getMonth()
      })
    )
  }, [invoices])

  const filtersActive = q.trim() !== '' || statusFilter !== 'all'

  const filtered = useMemo(() => {
    if (!invoices) return []
    const needle = q.trim().toLowerCase()
    const rows = invoices.filter((r) => {
      if (statusFilter === 'overdue') {
        if (!isOverdue(r.status, r.due_date)) return false
      } else if (statusFilter !== 'all' && r.status !== statusFilter) {
        return false
      }
      if (!needle) return true
      const number = (r.invoice_number ?? '').toLowerCase()
      const client = (r.clients?.name ?? '').toLowerCase()
      return number.includes(needle) || client.includes(needle)
    })
    if (statusFilter === 'all') {
      // stable sort: overdue rows first, otherwise preserve the created_at-desc order from the API
      return [...rows].sort((a, b) => {
        const aOverdue = isOverdue(a.status, a.due_date) ? 0 : 1
        const bOverdue = isOverdue(b.status, b.due_date) ? 0 : 1
        return aOverdue - bOverdue
      })
    }
    return rows
  }, [invoices, q, statusFilter])

  async function deleteInvoice() {
    if (!confirmDelete) return
    const res = await fetch(`/api/invoices/${confirmDelete.id}`, { method: 'DELETE' })
    if (res.ok) {
      setInvoices((prev) => (prev ?? []).filter((r) => r.id !== confirmDelete.id))
      toast('Invoice deleted')
    } else {
      toast('Failed to delete invoice', 'error')
    }
  }

  if (!invoices) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="size-10 text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Outstanding</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{outstanding}</p>
          {overdueRows.length > 0 && (
            <p className="mt-1 text-xs text-red-600">{overdueSum} overdue</p>
          )}
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Paid this month</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{paidThisMonth}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Total invoices</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{invoices.length}</p>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by number or client…"
          className="max-w-xs"
        />
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                statusFilter === t.key ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {invoices.length === 0 && !filtersActive ? (
        <EmptyState
          title="No invoices yet"
          hint="Create your first invoice to get started."
          action={<Link href="/invoices/new"><Button>New invoice</Button></Link>}
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-zinc-500 border-b border-zinc-200 bg-zinc-50">
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Issue date</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-zinc-500 border-b border-zinc-100" colSpan={6}>
                    No matches
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer hover:bg-zinc-50"
                    onClick={() => router.push(`/invoices/${r.id}`)}
                  >
                    <td className="px-4 py-3 text-sm font-medium border-b border-zinc-100">
                      {r.invoice_number ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm border-b border-zinc-100">{r.clients?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-sm border-b border-zinc-100">{formatDateLong(r.issue_date)}</td>
                    <td className="px-4 py-3 text-sm border-b border-zinc-100">
                      {formatMoney(Number(r.total), r.currency)}
                    </td>
                    <td className="px-4 py-3 text-sm border-b border-zinc-100">
                      {isOverdue(r.status, r.due_date) ? (
                        <Badge status="overdue" label={`Overdue · ${daysOverdue(r.due_date)}d`} />
                      ) : (
                        <Badge status={r.status} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm border-b border-zinc-100">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/invoices/${r.id}`)
                          }}
                        >
                          PDF
                        </Button>
                        {r.status === 'draft' && (
                          <Button
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/invoices/${r.id}/edit`)
                            }}
                          >
                            Edit
                          </Button>
                        )}
                        {r.status === 'finalized' && (
                          <Button
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={(e) => {
                              e.stopPropagation()
                              setPayingRow(r)
                            }}
                          >
                            Record payment
                          </Button>
                        )}
                        {r.status === 'draft' && (
                          <Button
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={(e) => {
                              e.stopPropagation()
                              setConfirmDelete(r)
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={deleteInvoice}
        title="Delete draft?"
        message="This permanently deletes the draft invoice."
        confirmLabel="Delete"
        danger
      />

      {payingRow && (
        <RecordPaymentModal
          invoice={{
            id: payingRow.id,
            invoice_number: payingRow.invoice_number,
            total: Number(payingRow.total),
            currency: payingRow.currency,
          }}
          open={!!payingRow}
          onClose={() => setPayingRow(null)}
          onSaved={(inv) => {
            setInvoices((prev) =>
              (prev ?? []).map((r) => (r.id === inv.id ? { ...r, status: inv.status, updated_at: inv.updated_at } : r))
            )
            setPayingRow(null)
          }}
        />
      )}
    </div>
  )
}
