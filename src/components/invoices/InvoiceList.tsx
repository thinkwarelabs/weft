'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
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

interface InvoiceStats {
  outstanding: Record<string, number>
  overdue: Record<string, number>
  overdueCount: number
  paidThisMonth: Record<string, number>
  totalCount: number
}

interface InvoicesResponse {
  invoices: InvoiceListRow[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  stats: InvoiceStats
}

function formatCurrencyMap(map: Record<string, number>): string {
  const entries = Object.entries(map)
  if (entries.length === 0) return '—'
  return entries.map(([c, n]) => formatMoney(n, c)).join(' · ')
}

export function InvoiceList() {
  const [rows, setRows] = useState<InvoiceListRow[] | null>(null)
  const [stats, setStats] = useState<InvoiceStats | null>(null)
  const [total, setTotal] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('') // raw input
  const [q, setQ] = useState('') // debounced query
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [pending, setPending] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState<InvoiceListRow | null>(null)
  const [payingRow, setPayingRow] = useState<InvoiceListRow | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  // Debounce the search box into `q`, resetting to the first page on change.
  useEffect(() => {
    const t = setTimeout(() => {
      setPending(true)
      setPage(1)
      setQ(search.trim())
    }, 250)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let ignore = false
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), status: statusFilter })
    if (q) params.set('q', q)
    fetch(`/api/invoices?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('request failed'))))
      .then((d: InvoicesResponse) => {
        if (ignore) return
        setRows(d.invoices ?? [])
        setStats(d.stats)
        setTotal(d.total ?? 0)
        setPageCount(d.pageCount ?? 1)
      })
      .catch(() => {
        if (!ignore) toast('Failed to load invoices', 'error')
      })
      .finally(() => {
        if (!ignore) setPending(false)
      })
    return () => {
      ignore = true
    }
  }, [page, pageSize, q, statusFilter, reloadTick, toast])

  function reload() {
    setPending(true)
    setReloadTick((t) => t + 1)
  }

  function goToPage(next: number) {
    setPending(true)
    setPage(next)
  }

  function changePageSize(size: number) {
    setPending(true)
    setPage(1)
    setPageSize(size)
  }

  function selectTab(key: StatusFilter) {
    setPending(true)
    setPage(1)
    setStatusFilter(key)
  }

  async function deleteInvoice() {
    if (!confirmDelete) return
    const res = await fetch(`/api/invoices/${confirmDelete.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast('Invoice deleted')
      reload()
    } else {
      toast('Failed to delete invoice', 'error')
    }
  }

  const filtersActive = q !== '' || statusFilter !== 'all'

  if (rows === null || stats === null) {
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
          <p className="mt-2 text-2xl font-semibold tracking-tight">{formatCurrencyMap(stats.outstanding)}</p>
          {stats.overdueCount > 0 && (
            <p className="mt-1 text-xs text-red-600">{formatCurrencyMap(stats.overdue)} overdue</p>
          )}
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Paid this month</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{formatCurrencyMap(stats.paidThisMonth)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Total invoices</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{stats.totalCount}</p>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by number or client…"
          className="max-w-xs"
        />
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => selectTab(t.key)}
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

      {stats.totalCount === 0 && !filtersActive ? (
        <EmptyState
          title="No invoices yet"
          hint="Create your first invoice to get started."
          action={<Link href="/invoices/new"><Button>New invoice</Button></Link>}
        />
      ) : (
        <>
          <Card className="p-0 overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-zinc-500 border-b border-zinc-200 bg-zinc-50">
                  <th className="whitespace-nowrap px-4 py-3">Number</th>
                  <th className="w-full px-4 py-3">Client</th>
                  <th className="whitespace-nowrap px-4 py-3">Issue date</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Total</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-zinc-500 border-b border-zinc-100" colSpan={6}>
                      No matches
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr
                      key={r.id}
                      className="cursor-pointer hover:bg-zinc-50"
                      onClick={() => router.push(`/invoices/${r.id}`)}
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium border-b border-zinc-100">
                        {r.invoice_number ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm border-b border-zinc-100">{r.clients?.name ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 border-b border-zinc-100">{formatDateLong(r.issue_date)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-right tabular-nums border-b border-zinc-100">
                        {formatMoney(Number(r.total), r.currency)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm border-b border-zinc-100">
                        {isOverdue(r.status, r.due_date) ? (
                          <Badge status="overdue" label={`Overdue · ${daysOverdue(r.due_date)}d`} />
                        ) : (
                          <Badge status={r.status} />
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm border-b border-zinc-100">
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

          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            pageSize={pageSize}
            onPageChange={goToPage}
            onPageSizeChange={changePageSize}
            disabled={pending}
            singular="invoice"
            plural="invoices"
          />
        </>
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
          onSaved={() => {
            setPayingRow(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
