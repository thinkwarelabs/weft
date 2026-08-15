'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/legacy/Pagination'
import { Select } from '@/components/legacy/Select'
import { Spinner } from '@/components/legacy/Spinner'
import { useToast } from '@/components/legacy/Toast'

interface AuditLogRow {
  id: string
  created_at: string
  actor_email: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown> | null
  ip: string | null
}

interface AuditResponse {
  logs: AuditLogRow[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

const ENTITY_OPTIONS = [
  { value: '', label: 'All entities' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'client', label: 'Client' },
  { value: 'expense', label: 'Expense' },
  { value: 'settings', label: 'Settings' },
]

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'invoice.create', label: 'invoice.create' },
  { value: 'invoice.update', label: 'invoice.update' },
  { value: 'invoice.delete', label: 'invoice.delete' },
  { value: 'invoice.finalize', label: 'invoice.finalize' },
  { value: 'invoice.void', label: 'invoice.void' },
  { value: 'invoice.unvoid', label: 'invoice.unvoid' },
  { value: 'invoice.mark_paid', label: 'invoice.mark_paid' },
  { value: 'invoice.unmark_paid', label: 'invoice.unmark_paid' },
  { value: 'client.create', label: 'client.create' },
  { value: 'client.update', label: 'client.update' },
  { value: 'client.archive', label: 'client.archive' },
  { value: 'client.unarchive', label: 'client.unarchive' },
  { value: 'expense.create', label: 'expense.create' },
  { value: 'expense.update', label: 'expense.update' },
  { value: 'expense.delete', label: 'expense.delete' },
  { value: 'settings.update', label: 'settings.update' },
]

function formatWhen(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AuditLog() {
  const [data, setData] = useState<AuditResponse | null>(null)
  const [pending, setPending] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [actor, setActor] = useState('')
  const [action, setAction] = useState('')
  const [entityType, setEntityType] = useState('')
  const { toast } = useToast()

  // Refetch whenever the page or a filter changes. All setState happens in the
  // async callbacks; `pending` is flipped on by the handlers that trigger the
  // change, so nothing sets state synchronously in the effect body.
  useEffect(() => {
    let ignore = false
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (actor.trim()) params.set('actor', actor.trim())
    if (action) params.set('action', action)
    if (entityType) params.set('entityType', entityType)
    fetch(`/api/audit?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('request failed'))))
      .then((d: AuditResponse) => {
        if (!ignore) setData(d)
      })
      .catch(() => {
        if (!ignore) toast('Failed to load audit log', 'error')
      })
      .finally(() => {
        if (!ignore) setPending(false)
      })
    return () => {
      ignore = true
    }
  }, [page, pageSize, actor, action, entityType, toast])

  function goToPage(next: number) {
    setPending(true)
    setPage(next)
  }

  function changePageSize(size: number) {
    setPending(true)
    setPage(1)
    setPageSize(size)
  }

  // Any filter change resets to the first page.
  function onFilterChange(setter: (v: string) => void) {
    return (v: string) => {
      setPending(true)
      setPage(1)
      setter(v)
    }
  }

  const logs = data?.logs ?? []
  const loading = pending || data === null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={actor}
          onChange={(e) => onFilterChange(setActor)(e.target.value)}
          placeholder="Filter by actor email…"
          className="max-w-xs"
        />
        <div className="w-52">
          <Select value={action} onChange={onFilterChange(setAction)} options={ACTION_OPTIONS} />
        </div>
        <div className="w-44">
          <Select value={entityType} onChange={onFilterChange(setEntityType)} options={ENTITY_OPTIONS} />
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        <CardContent>
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-zinc-500 border-b border-zinc-200 bg-zinc-50">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-16 text-center border-b border-zinc-100" colSpan={5}>
                    <Spinner className="mx-auto size-6 text-zinc-400" />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-sm text-zinc-500 border-b border-zinc-100" colSpan={5}>
                    No audit entries
                  </td>
                </tr>
              ) : (
                logs.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 border-b border-zinc-100">
                      {formatWhen(row.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm border-b border-zinc-100">{row.actor_email ?? 'system'}</td>
                    <td className="px-4 py-3 text-sm font-medium border-b border-zinc-100">
                      <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">{row.action}</code>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 border-b border-zinc-100">
                      {row.entity_type ? (
                        <span>
                          {row.entity_type}
                          {row.entity_id ? <span className="text-zinc-400"> · {row.entity_id.slice(0, 8)}</span> : null}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-xs text-zinc-500 border-b border-zinc-100">
                      {row.metadata && Object.keys(row.metadata).length > 0 ? (
                        <code className="break-words">{JSON.stringify(row.metadata)}</code>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Pagination
        page={data?.page ?? page}
        pageCount={data?.pageCount ?? 1}
        total={data?.total ?? 0}
        pageSize={pageSize}
        onPageChange={goToPage}
        onPageSizeChange={changePageSize}
        disabled={loading}
      />
    </div>
  )
}
