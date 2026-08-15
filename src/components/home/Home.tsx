'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Card } from '@/components/legacy/Card'
import { Spinner } from '@/components/legacy/Spinner'
import { useToast } from '@/components/legacy/Toast'
import { formatMoney } from '@/lib/money'
import type { ChecklistProgress } from '@/lib/onboarding'

interface HomeData {
  overdue: {
    count: number
    byCurrency: Record<string, number>
    invoices: {
      id: string
      invoice_number: string | null
      client: string
      due_date: string
      currency: string
      total: number
    }[]
  }
  draftCount: number
  waiting: {
    id: string
    prompt: string
    created_at: string
    contact: string
    project: { id: string; name: string; client: string }
  }[]
  stalledOnboarding: {
    id: string
    name: string
    client: string
    updated_at: string
    progress: ChecklistProgress
  }[]
  recent: {
    id: string
    kind: string
    body: string
    created_at: string
    author: string
    author_type: 'internal' | 'client'
    project: { id: string; name: string; client: string }
  }[]
}

function daysSince(iso: string, now: number): number {
  return Math.floor((now - new Date(iso).getTime()) / 86_400_000)
}

export function Home() {
  const [data, setData] = useState<HomeData | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const { toast } = useToast()

  useEffect(() => {
    const ac = new AbortController()
    fetch('/api/home', { signal: ac.signal })
      .then((r) => r.json())
      .then(setData)
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        toast('Failed to load', 'error')
      })
    return () => ac.abort()
  }, [toast])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [])

  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="size-10 text-zinc-400" />
      </div>
    )
  }

  const nothingWaiting =
    data.overdue.count === 0 && data.waiting.length === 0 && data.stalledOnboarding.length === 0

  return (
    <div className="flex flex-col gap-6">
      {nothingWaiting ? (
        <Card>
          <p className="text-sm text-zinc-600">
            Nothing needs attention. No overdue invoices, no feedback outstanding, no stalled
            onboarding.
          </p>
        </Card>
      ) : (
        <Card title="Needs attention">
          <ul className="flex flex-col divide-y divide-zinc-100">
            {data.overdue.count > 0 && (
              <li className="py-3 first:pt-0">
                <Link href="/invoices?status=overdue" className="group flex items-start gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-red-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-zinc-900 group-hover:underline">
                      {data.overdue.count === 1
                        ? '1 invoice is overdue'
                        : `${data.overdue.count} invoices are overdue`}
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {Object.entries(data.overdue.byCurrency)
                        .map(([c, amount]) => formatMoney(amount, c))
                        .join(' · ')}
                      {data.overdue.invoices[0] &&
                        ` · oldest ${data.overdue.invoices[0].client}, ${daysSince(
                          data.overdue.invoices[0].due_date,
                          now
                        )} days`}
                    </span>
                  </span>
                </Link>
              </li>
            )}

            {data.waiting.map((w) => (
              <li key={w.id} className="py-3 first:pt-0">
                <Link href={`/projects/${w.project.id}`} className="group flex items-start gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-amber-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-900 group-hover:underline">
                      {w.project.client} · {w.project.name} — waiting on {w.contact}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">
                      &ldquo;{w.prompt}&rdquo; · asked {daysSince(w.created_at, now)} days ago
                    </span>
                  </span>
                </Link>
              </li>
            ))}

            {data.stalledOnboarding.map((p) => (
              <li key={p.id} className="py-3 first:pt-0">
                <Link href={`/projects/${p.id}`} className="group flex items-start gap-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-zinc-300" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-900 group-hover:underline">
                      {p.client} · {p.name} — onboarding {p.progress.done}/{p.progress.total}
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {p.progress.complete
                        ? 'Checklist done — move it to Active'
                        : `Untouched for ${daysSince(p.updated_at, now)} days`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.draftCount > 0 && (
        <Card>
          <Link href="/invoices?status=draft" className="text-sm text-zinc-600 hover:underline">
            {data.draftCount === 1
              ? '1 invoice is still a draft'
              : `${data.draftCount} invoices are still drafts`}
          </Link>
        </Card>
      )}

      <Card title="Recent activity">
        {data.recent.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing logged yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-100">
            {data.recent.map((e) => (
              <li key={e.id} className="py-2.5 first:pt-0">
                <Link href={`/projects/${e.project.id}`} className="group block">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-zinc-500">
                    <span
                      className={
                        e.author_type === 'client'
                          ? 'font-medium text-emerald-700'
                          : 'font-medium text-zinc-700'
                      }
                    >
                      {e.author}
                    </span>
                    <span className="truncate group-hover:underline">
                      {e.project.client} · {e.project.name}
                    </span>
                    <span aria-hidden>·</span>
                    <time dateTime={e.created_at}>
                      {daysSince(e.created_at, now) === 0
                        ? 'today'
                        : `${daysSince(e.created_at, now)}d ago`}
                    </time>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-zinc-700">{e.body}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
