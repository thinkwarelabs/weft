'use client'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { DELETE_WINDOW_MS } from '@/lib/timeline'
import type { TimelineEntry } from '@/lib/types'

type ItemKind = 'note' | 'milestone' | 'status_change' | 'feedback' | 'feedback_request'

interface TimelineItem {
  id: string
  kind: ItemKind
  body: string
  author: { kind: 'internal' | 'client' | 'system'; name: string }
  created_at: string
  author_type?: 'internal' | 'client'
  sent_to: string | null
  answered_at: string | null
  replies: TimelineEntry[]
}

const KIND: Record<ItemKind, { dot: string; label: string; hint: string }> = {
  note: { dot: 'bg-zinc-300', label: 'Internal note', hint: 'Only we can see this' },
  milestone: { dot: 'bg-blue-500', label: 'Milestone', hint: 'The client will see this' },
  feedback: { dot: 'bg-emerald-500', label: 'Client feedback', hint: '' },
  status_change: { dot: 'bg-zinc-200', label: 'Status', hint: '' },
  feedback_request: { dot: 'bg-amber-400', label: 'Feedback requested', hint: '' },
}

// `now` is passed in rather than read from the clock, so rendering stays pure
// and the whole list re-times off a single ticking value.
function relativeTime(iso: string, now: number): string {
  const diff = now - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function Timeline({
  projectId,
  actorName,
  reloadSignal = 0,
}: {
  projectId: string
  actorName: string
  /** Bumped by siblings (e.g. sending a feedback request) to force a refetch. */
  reloadSignal?: number
}) {
  const [items, setItems] = useState<TimelineItem[] | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<'note' | 'milestone'>('note')
  const [saving, setSaving] = useState(false)
  // The clock, held in state and ticked, so render never calls Date.now().
  const [now, setNow] = useState(() => Date.now())
  const { toast } = useToast()

  const refresh = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    const ac = new AbortController()
    fetch(`/api/projects/${projectId}/timeline`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        toast('Failed to load the timeline', 'error')
      })
    return () => ac.abort()
  }, [projectId, reloadKey, reloadSignal, toast])

  useEffect(() => {
    // Ticks the delete window closed on screen without needing a reload.
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  async function add() {
    const text = body.trim()
    if (!text) return
    setSaving(true)
    const res = await fetch(`/api/projects/${projectId}/timeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, body: text }),
    })
    setSaving(false)
    if (res.ok) {
      setBody('')
      refresh()
    } else {
      const d = await res.json().catch(() => ({}))
      toast(d.error ?? 'Failed to save', 'error')
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/timeline/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast(d.error ?? 'Could not remove that entry', 'error')
    } else {
      toast('Removed')
    }
    refresh()
  }

  return (
    <Card title="Timeline">
      <div className="flex flex-col gap-3 border-b border-zinc-100 pb-5">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder={
            kind === 'note'
              ? 'What was said, decided, or promised — while it’s fresh.'
              : 'A milestone the client should see.'
          }
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1 rounded-lg bg-zinc-100 p-0.5">
            {(['note', 'milestone'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  'cursor-pointer rounded-md px-3 py-1 text-sm font-medium transition-colors',
                  kind === k ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'
                )}
              >
                {KIND[k].label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500">{KIND[kind].hint}</span>
            <Button onClick={add} loading={saving} disabled={!body.trim()}>
              Add
            </Button>
          </div>
        </div>
      </div>

      {!items ? (
        <div className="flex min-h-[20vh] items-center justify-center">
          <Spinner className="size-8 text-zinc-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="pt-6">
          <EmptyState
            title="Nothing logged yet"
            hint="Write down what happened on the last call. The habit is the point."
          />
        </div>
      ) : (
        <ul className="flex flex-col pt-2">
          {items.map((item) => {
            const style = KIND[item.kind]
            const age = now - new Date(item.created_at).getTime()
            const canRemove =
              item.kind !== 'feedback_request' &&
              item.author_type === 'internal' &&
              item.author.name === actorName &&
              age < DELETE_WINDOW_MS

            return (
              <li key={item.id} className="group relative flex gap-3 py-3">
                <div className="flex flex-col items-center">
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', style.dot)} />
                  <span className="mt-1 w-px flex-1 bg-zinc-100 group-last:hidden" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-zinc-500">
                    <span className="font-medium text-zinc-700">{item.author.name}</span>
                    <span>{style.label}</span>
                    {item.sent_to && <span>to {item.sent_to}</span>}
                    <span aria-hidden>·</span>
                    <time dateTime={item.created_at}>{relativeTime(item.created_at, now)}</time>
                    {item.kind === 'feedback_request' && !item.answered_at && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                        Waiting
                      </span>
                    )}
                    {canRemove && (
                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        className="cursor-pointer text-zinc-400 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">{item.body}</p>

                  {/* The reply, nested under the thing it answers. */}
                  {item.replies.map((reply) => (
                    <div
                      key={reply.id}
                      className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-emerald-800">
                        <span className="font-medium">{reply.author.name}</span>
                        <span>replied</span>
                        <span aria-hidden>·</span>
                        <time dateTime={reply.created_at}>
                          {relativeTime(reply.created_at, now)}
                        </time>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">{reply.body}</p>
                    </div>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
