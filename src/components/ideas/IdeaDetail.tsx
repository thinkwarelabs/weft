'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { DELETE_WINDOW_MS, buildThread } from '@/lib/ideas'

interface CommentRow {
  id: string
  parent_id: string | null
  body: string
  created_at: string
  author: { id: string; name: string }
}

interface Idea {
  id: string
  title: string
  body: string
  created_at: string
  author: { id: string; name: string }
  project: { id: string; name: string } | null
}

export function IdeaDetail({ idea, actorId }: { idea: Idea; actorId: string }) {
  const [comments, setComments] = useState<CommentRow[] | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const router = useRouter()

  useEffect(() => {
    const ac = new AbortController()
    fetch(`/api/ideas/${idea.id}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => setComments(d.comments ?? []))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        toast.error('Failed to load comments')
      })
    return () => ac.abort()
  }, [idea.id, reloadKey])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const canDelete =
    idea.author.id === actorId && now - new Date(idea.created_at).getTime() < DELETE_WINDOW_MS

  async function removeIdea() {
    const res = await fetch(`/api/ideas/${idea.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Idea deleted')
      router.push('/ideas')
      return
    }
    const d = await res.json().catch(() => ({}))
    toast.error(d.error ?? 'Could not delete')
  }

  const threads = comments ? buildThread(comments.map((c) => ({ ...c, parentId: c.parent_id }))) : []

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent>
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-xl font-semibold tracking-tight">{idea.title}</h1>
            {canDelete && (
              <Button variant="ghost" className="h-7 shrink-0 px-2" onClick={removeIdea}>
                Delete
              </Button>
            )}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-800">{idea.body}</p>
          <p className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
            {idea.author.name} · {new Date(idea.created_at).toLocaleString()}
            {idea.project && (
              <>
                {' · '}
                <Link href={`/projects/${idea.project.id}`} className="hover:underline">
                  {idea.project.name}
                </Link>
              </>
            )}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent>
          <CommentComposer
            ideaId={idea.id}
            parentId={null}
            onPosted={() => setReloadKey((k) => k + 1)}
          />

          {!comments ? (
            <div className="flex min-h-[15vh] items-center justify-center">
              <Spinner className="size-8 text-zinc-400" />
            </div>
          ) : threads.length === 0 ? (
            <p className="pt-5 text-sm text-zinc-500">
              No comments yet. This is where the idea gets refined.
            </p>
          ) : (
            <ul className="flex flex-col gap-4 pt-5">
              {threads.map((t) => (
                <CommentNode
                  key={t.node.id}
                  thread={t}
                  ideaId={idea.id}
                  depth={0}
                  replyTo={replyTo}
                  setReplyTo={setReplyTo}
                  onPosted={() => {
                    setReplyTo(null)
                    setReloadKey((k) => k + 1)
                  }}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

type Thread = ReturnType<typeof buildThread<CommentRow & { parentId: string | null }>>[number]

function CommentNode({
  thread,
  ideaId,
  depth,
  replyTo,
  setReplyTo,
  onPosted,
}: {
  thread: Thread
  ideaId: string
  depth: number
  replyTo: string | null
  setReplyTo: (id: string | null) => void
  onPosted: () => void
}) {
  const c = thread.node
  return (
    <li className={depth > 0 ? 'border-l border-zinc-200 pl-4' : ''}>
      <div className="text-xs text-zinc-500">
        <span className="font-medium text-zinc-700">{c.author.name}</span>{' '}
        {new Date(c.created_at).toLocaleString()}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">{c.body}</p>

      <button
        type="button"
        onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
        className="mt-1 cursor-pointer text-xs text-zinc-500 hover:text-zinc-900"
      >
        {replyTo === c.id ? 'Cancel' : 'Reply'}
      </button>

      {replyTo === c.id && (
        <div className="mt-2">
          <CommentComposer ideaId={ideaId} parentId={c.id} onPosted={onPosted} autoFocus />
        </div>
      )}

      {thread.replies.length > 0 && (
        <ul className="mt-4 flex flex-col gap-4">
          {thread.replies.map((r) => (
            <CommentNode
              key={r.node.id}
              thread={r}
              ideaId={ideaId}
              depth={depth + 1}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
              onPosted={onPosted}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function CommentComposer({
  ideaId,
  parentId,
  onPosted,
  autoFocus,
}: {
  ideaId: string
  parentId: string | null
  onPosted: () => void
  autoFocus?: boolean
}) {
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  async function post() {
    const text = body.trim()
    if (!text) return
    setSaving(true)
    const res = await fetch(`/api/ideas/${ideaId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text, parent_id: parentId }),
    })
    setSaving(false)
    if (res.ok) {
      setBody('')
      onPosted()
      return
    }
    const d = await res.json().catch(() => ({}))
    toast.error(d.error ?? 'Failed to post')
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={parentId ? 2 : 3}
        autoFocus={autoFocus}
        placeholder={parentId ? 'Reply…' : 'Build on this, or push back on it.'}
      />
      <div className="flex justify-end">
        <Button onClick={post} loading={saving} disabled={!body.trim()}>
          {parentId ? 'Reply' : 'Comment'}
        </Button>
      </div>
    </div>
  )
}
