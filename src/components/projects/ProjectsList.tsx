'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/legacy/EmptyState'
import { Spinner } from '@/components/legacy/Spinner'
import { useToast } from '@/components/legacy/Toast'
import { cn } from '@/lib/cn'
import type { Project, ProjectStatus } from '@/lib/types'
import { ProjectStatusBadge } from './ProjectStatusBadge'

interface Row extends Project {
  client: { id: string; name: string }
  counts: { invoices: number; entries: number }
}

// Active work first — a closed project is history, not something to scan past.
const ORDER: ProjectStatus[] = ['onboarding', 'active', 'paused', 'closed']

const FILTERS: { value: 'all' | ProjectStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'closed', label: 'Closed' },
]

export function ProjectsList() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [filter, setFilter] = useState<'all' | ProjectStatus>('all')
  const { toast } = useToast()

  useEffect(() => {
    const ac = new AbortController()
    fetch('/api/projects', { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => setRows(d.projects ?? []))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        toast('Failed to load projects', 'error')
      })
    return () => ac.abort()
  }, [toast])

  if (!rows) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="size-10 text-zinc-400" />
      </div>
    )
  }

  const visible = (filter === 'all' ? rows : rows.filter((r) => r.status === filter)).sort(
    (a, b) =>
      ORDER.indexOf(a.status) - ORDER.indexOf(b.status) ||
      a.client.name.localeCompare(b.client.name)
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-lg bg-zinc-100 p-0.5 self-start">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              'cursor-pointer rounded-md px-3 py-1 text-sm font-medium transition-colors',
              filter === f.value
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={filter === 'all' ? 'No projects yet' : `Nothing ${filter}`}
          hint={
            filter === 'all'
              ? 'Projects are created from a client — open one to start an engagement.'
              : 'Try a different filter.'
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <CardContent>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <th className="w-full px-4 py-3">Project</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                  <th className="whitespace-nowrap px-4 py-3">Onboarding</th>
                  <th className="whitespace-nowrap px-4 py-3">Activity</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50">
                    <td className="border-b border-zinc-100 px-4 py-3 text-sm">
                      <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                        {p.name}
                      </Link>
                      <span className="ml-2 text-zinc-500">{p.client.name}</span>
                    </td>
                    <td className="whitespace-nowrap border-b border-zinc-100 px-4 py-3">
                      <ProjectStatusBadge status={p.status} />
                    </td>
                    <td className="whitespace-nowrap border-b border-zinc-100 px-4 py-3 text-sm text-zinc-600">
                      {p.onboarding_progress.complete
                        ? '✓'
                        : `${p.onboarding_progress.done}/${p.onboarding_progress.total}`}
                    </td>
                    <td className="whitespace-nowrap border-b border-zinc-100 px-4 py-3 text-sm text-zinc-500">
                      {p.counts.entries === 0 ? '—' : `${p.counts.entries} entries`}
                      {p.counts.invoices > 0 && ` · ${p.counts.invoices} invoices`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
