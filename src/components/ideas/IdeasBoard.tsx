'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/legacy/Card'
import { EmptyState } from '@/components/legacy/EmptyState'
import { Field } from '@/components/legacy/Field'
import { Input } from '@/components/legacy/Input'
import { Modal } from '@/components/legacy/Modal'
import { Spinner } from '@/components/legacy/Spinner'
import { Textarea } from '@/components/legacy/Textarea'
import { useToast } from '@/components/legacy/Toast'

interface IdeaRow {
  id: string
  title: string
  body: string
  created_at: string
  author: { id: string; name: string }
  project: { id: string; name: string } | null
  comment_count: number
}

export function IdeasBoard() {
  const [ideas, setIdeas] = useState<IdeaRow[] | null>(null)
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [composing, setComposing] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    const ac = new AbortController()
    const url = q ? `/api/ideas?q=${encodeURIComponent(q)}` : '/api/ideas'
    fetch(url, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => setIdeas(d.ideas ?? []))
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        toast('Failed to load ideas', 'error')
      })
    return () => ac.abort()
  }, [q, reloadKey, toast])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ideas…"
          className="max-w-sm"
        />
        <div className="ml-auto">
          <Button onClick={() => setComposing(true)}>New idea</Button>
        </div>
      </div>

      {!ideas ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner className="size-10 text-zinc-400" />
        </div>
      ) : ideas.length === 0 ? (
        <EmptyState
          title={q ? 'No matching ideas' : 'No ideas yet'}
          hint={
            q
              ? 'Try a different search.'
              : 'Post the half-formed one. That’s what the comments are for.'
          }
          action={!q ? <Button onClick={() => setComposing(true)}>New idea</Button> : undefined}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {ideas.map((idea) => (
            <li key={idea.id}>
              <Link href={`/ideas/${idea.id}`} className="block">
                <Card className="transition-colors hover:border-zinc-300">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="font-medium tracking-tight">{idea.title}</h3>
                    <span className="shrink-0 text-xs text-zinc-500">
                      {idea.comment_count === 0
                        ? 'No comments'
                        : idea.comment_count === 1
                          ? '1 comment'
                          : `${idea.comment_count} comments`}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{idea.body}</p>
                  <p className="mt-2 text-xs text-zinc-500">
                    {idea.author.name} · {new Date(idea.created_at).toLocaleDateString()}
                    {idea.project && ` · ${idea.project.name}`}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {composing && (
        <NewIdeaModal
          onClose={() => setComposing(false)}
          onCreated={() => {
            setComposing(false)
            setReloadKey((k) => k + 1)
          }}
        />
      )}
    </div>
  )
}

function NewIdeaModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { toast } = useToast()

  async function save() {
    setSaving(true)
    setErrors({})
    const res = await fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), body: body.trim() }),
    })
    setSaving(false)
    if (res.ok) {
      onCreated()
      toast('Idea posted')
      return
    }
    const d = await res.json().catch(() => ({}))
    if (d.issues) {
      setErrors(
        Object.fromEntries(Object.entries(d.issues).map(([k, v]) => [k, (v as string[])[0]]))
      )
    }
    toast(d.error ?? 'Failed to post', 'error')
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New idea"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} onClick={save} disabled={!title.trim() || !body.trim()}>
            Post
          </Button>
        </>
      }
    >
      <Field label="Title" error={errors.title}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </Field>
      <div className="mt-4">
        <Field label="The idea" error={errors.body}>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
        </Field>
      </div>
      <p className="mt-4 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
        Once posted this can&apos;t be edited — refine it in the comments. You can delete your own
        idea within 15 minutes.
      </p>
    </Modal>
  )
}
