'use client'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { formatDateLong, todayISO } from '@/lib/dates'
import {
  CurrencyBucket,
  ExpenseRow,
  PeriodSel,
  RevenueRow,
  aggregate,
  monthlyBreakdown,
  monthsInRange,
  periodRange,
} from '@/lib/financials'
import { formatMoney, round2 } from '@/lib/money'
import { Expense } from '@/lib/types'
import { ExpenseFormModal } from './ExpenseFormModal'
import { PeriodSelector } from './PeriodSelector'

interface FinancialsInvoice {
  id: string
  invoice_number: string | null
  currency: string
  subtotal: number | string
  tax_amount: number | string
  total: number | string
  amount_received: number | string | null
  tds_amount: number | string
  paid_at: string | null
  updated_at: string
  paidDate: string
  clients: { name: string } | null
}

interface CurrencyAmount {
  currency: string
  amount: number
}

function sumTdsByCurrency(invoices: FinancialsInvoice[]): CurrencyAmount[] {
  const map = new Map<string, number>()
  for (const inv of invoices) map.set(inv.currency, (map.get(inv.currency) ?? 0) + Number(inv.tds_amount))
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => ({ currency, amount: round2(amount) }))
}

function CurrencyAmountLines({ amounts }: { amounts: CurrencyAmount[] }) {
  if (amounts.length === 0) return <span className="text-zinc-400">—</span>
  return (
    <div className="flex flex-col gap-0.5">
      {amounts.map((a) => (
        <span key={a.currency}>{formatMoney(a.amount, a.currency)}</span>
      ))}
    </div>
  )
}

interface FinancialsData {
  invoices: FinancialsInvoice[]
  expenses: Expense[]
}

function defaultPeriod(): PeriodSel {
  const [year, month] = todayISO().split('-').map(Number)
  return { granularity: 'month', year, index: month - 1 }
}

function CurrencyLines({ buckets, field }: { buckets: CurrencyBucket[]; field: keyof CurrencyBucket }) {
  if (buckets.length === 0) return <span className="text-zinc-400">—</span>
  return (
    <div className="flex flex-col gap-0.5">
      {buckets.map((b) => {
        const value = b[field] as number
        return (
          <span
            key={b.currency}
            className={cn(field === 'net' && (value >= 0 ? 'text-emerald-700' : 'text-red-600'))}
          >
            {formatMoney(value, b.currency)}
          </span>
        )
      })}
    </div>
  )
}

const SUMMARY_CARDS: { label: string; field: keyof CurrencyBucket }[] = [
  { label: 'Revenue ex-GST', field: 'exGst' },
  { label: 'GST collected', field: 'gst' },
  { label: 'Total revenue', field: 'total' },
  { label: 'Expenses', field: 'expenses' },
  { label: 'Net', field: 'net' },
]

export function FinancialsDashboard() {
  const [sel, setSel] = useState<PeriodSel>(defaultPeriod())
  const [data, setData] = useState<FinancialsData | null>(null)
  const [defaultCurrency, setDefaultCurrency] = useState('USD')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [deleting, setDeleting] = useState<Expense | null>(null)
  const [allExpenseTypes, setAllExpenseTypes] = useState<string[]>([])
  const { toast } = useToast()

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => setDefaultCurrency(d.profile.default_currency))
      .catch(() => {})
  }, [])

  const loadExpenseTypes = useCallback(() => {
    fetch('/api/expenses')
      .then((r) => r.json())
      .then((d) => {
        const set = new Set<string>()
        for (const e of d.expenses ?? []) if (e.expense_type) set.add(e.expense_type)
        setAllExpenseTypes([...set].sort())
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    loadExpenseTypes()
  }, [loadExpenseTypes])

  const { from, to } = periodRange(sel)
  const ready = sel.granularity !== 'custom' || (!!from && !!to && from <= to)

  const loadFinancials = useCallback(
    ({ silent = false }: { silent?: boolean } = {}) => {
      if (!ready) {
        if (!silent) setData(null)
        return
      }
      if (!silent) setData(null)
      fetch(`/api/financials?from=${from}&to=${to}`)
        .then(async (r) => {
          const d = await r.json()
          if (!r.ok) {
            toast(d.error ?? 'Failed to load financials', 'error')
            return
          }
          setData(d)
        })
        .catch(() => toast('Failed to load financials', 'error'))
    },
    [ready, from, to, toast]
  )

  useEffect(() => {
    loadFinancials()
  }, [loadFinancials])

  const revenueRows: RevenueRow[] = useMemo(
    () =>
      (data?.invoices ?? []).map((inv) => ({
        currency: inv.currency,
        subtotal: Number(inv.subtotal),
        tax_amount: Number(inv.tax_amount),
        total: Number(inv.total),
        paidDate: inv.paidDate,
      })),
    [data]
  )

  const expenseRows: ExpenseRow[] = useMemo(
    () =>
      (data?.expenses ?? []).map((e) => ({
        currency: e.currency,
        amount: Number(e.amount),
        expense_date: e.expense_date,
      })),
    [data]
  )

  const buckets = useMemo(() => aggregate(revenueRows, expenseRows), [revenueRows, expenseRows])
  const tdsBuckets = useMemo(() => sumTdsByCurrency(data?.invoices ?? []), [data])

  const months = useMemo(() => (ready ? monthsInRange(from, to) : []), [ready, from, to])
  const showMonthly = months.length > 1
  const breakdown = useMemo(
    () => (showMonthly ? monthlyBreakdown(from, to, revenueRows, expenseRows) : []),
    [showMonthly, from, to, revenueRows, expenseRows]
  )

  const knownTypes = allExpenseTypes

  const paidInvoices = useMemo(
    () => [...(data?.invoices ?? [])].sort((a, b) => b.paidDate.localeCompare(a.paidDate)),
    [data]
  )

  const expensesSorted = useMemo(
    () => [...(data?.expenses ?? [])].sort((a, b) => b.expense_date.localeCompare(a.expense_date)),
    [data]
  )

  function openAdd() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(e: Expense) {
    setEditing(e)
    setModalOpen(true)
  }

  function onExpenseSaved() {
    loadFinancials({ silent: true })
    loadExpenseTypes()
  }

  async function deleteExpense() {
    if (!deleting) return
    const res = await fetch(`/api/expenses/${deleting.id}`, { method: 'DELETE' })
    if (res.ok) {
      setData((prev) => (prev ? { ...prev, expenses: prev.expenses.filter((e) => e.id !== deleting.id) } : prev))
      toast('Expense deleted')
    } else {
      toast('Failed to delete expense', 'error')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PeriodSelector sel={sel} onChange={setSel} />
        <Button onClick={openAdd}>Add expense</Button>
      </div>

      {!data ? (
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner className="size-10 text-zinc-400" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            {SUMMARY_CARDS.map((c) => (
              <Card key={c.field}>
                <p className="text-xs uppercase tracking-wide text-zinc-500">{c.label}</p>
                <div className="mt-2 text-2xl font-semibold tracking-tight">
                  <CurrencyLines buckets={buckets} field={c.field} />
                </div>
              </Card>
            ))}
            <Card>
              <p className="text-xs uppercase tracking-wide text-zinc-500">TDS deducted</p>
              <div className="mt-2 text-2xl font-semibold tracking-tight">
                <CurrencyAmountLines amounts={tdsBuckets} />
              </div>
            </Card>
          </div>

          {showMonthly && (
            <Card title="Monthly breakdown" className="p-0 overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                    <th className="px-4 py-3">Month</th>
                    <th className="px-4 py-3">Ex-GST</th>
                    <th className="px-4 py-3">GST</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Expenses</th>
                    <th className="px-4 py-3">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((row) => (
                    <tr key={row.label}>
                      <td className="border-b border-zinc-100 px-4 py-3 text-sm font-medium">{row.label}</td>
                      <td className="border-b border-zinc-100 px-4 py-3 text-sm">
                        <CurrencyLines buckets={row.buckets} field="exGst" />
                      </td>
                      <td className="border-b border-zinc-100 px-4 py-3 text-sm">
                        <CurrencyLines buckets={row.buckets} field="gst" />
                      </td>
                      <td className="border-b border-zinc-100 px-4 py-3 text-sm">
                        <CurrencyLines buckets={row.buckets} field="total" />
                      </td>
                      <td className="border-b border-zinc-100 px-4 py-3 text-sm">
                        <CurrencyLines buckets={row.buckets} field="expenses" />
                      </td>
                      <td className="border-b border-zinc-100 px-4 py-3 text-sm">
                        <CurrencyLines buckets={row.buckets} field="net" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          <div>
            <h2 className="mb-3 text-base font-semibold tracking-tight">Paid invoices</h2>
            {paidInvoices.length === 0 ? (
              <EmptyState title="No paid invoices in this period" hint="Invoices marked paid will show up here." />
            ) : (
              <Card className="p-0 overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      <th className="px-4 py-3">Number</th>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">Paid on</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Received</th>
                      <th className="px-4 py-3">TDS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paidInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-zinc-50">
                        <td className="border-b border-zinc-100 px-4 py-3 text-sm font-medium">
                          <Link href={`/invoices/${inv.id}`} className="hover:underline">
                            {inv.invoice_number ?? '—'}
                          </Link>
                        </td>
                        <td className="border-b border-zinc-100 px-4 py-3 text-sm">{inv.clients?.name ?? '—'}</td>
                        <td className="border-b border-zinc-100 px-4 py-3 text-sm">{formatDateLong(inv.paidDate)}</td>
                        <td className="border-b border-zinc-100 px-4 py-3 text-sm">
                          {formatMoney(Number(inv.total), inv.currency)}
                        </td>
                        <td className="border-b border-zinc-100 px-4 py-3 text-sm">
                          {formatMoney(Number(inv.amount_received), inv.currency)}
                        </td>
                        <td className="border-b border-zinc-100 px-4 py-3 text-sm">
                          {formatMoney(Number(inv.tds_amount), inv.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-base font-semibold tracking-tight">Expenses</h2>
            {expensesSorted.length === 0 ? (
              <EmptyState
                title="No expenses in this period"
                hint="Add an expense to start tracking it here."
                action={<Button onClick={openAdd}>Add expense</Button>}
              />
            ) : (
              <Card className="p-0 overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Paid by</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {expensesSorted.map((e) => (
                      <tr key={e.id} className="hover:bg-zinc-50">
                        <td className="border-b border-zinc-100 px-4 py-3 text-sm font-medium">{e.name}</td>
                        <td className="border-b border-zinc-100 px-4 py-3 text-sm">{e.expense_type ?? '—'}</td>
                        <td className="border-b border-zinc-100 px-4 py-3 text-sm">
                          {e.payer_type === 'company' ? 'Company account' : e.payer_name ?? '—'}
                        </td>
                        <td className="border-b border-zinc-100 px-4 py-3 text-sm">{formatDateLong(e.expense_date)}</td>
                        <td className="border-b border-zinc-100 px-4 py-3 text-sm">
                          {formatMoney(Number(e.amount), e.currency)}
                        </td>
                        <td className="border-b border-zinc-100 px-4 py-3 text-sm">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" className="h-7 px-2" onClick={() => openEdit(e)}>
                              Edit
                            </Button>
                            <Button variant="ghost" className="h-7 px-2" onClick={() => setDeleting(e)}>
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        </>
      )}

      <ExpenseFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editing}
        onSaved={onExpenseSaved}
        knownTypes={knownTypes}
        defaultCurrency={defaultCurrency}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={deleteExpense}
        title="Delete expense?"
        message="This permanently deletes the expense."
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
