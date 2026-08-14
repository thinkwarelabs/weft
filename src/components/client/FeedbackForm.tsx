'use client'
import { useState } from 'react'

// Client-facing. Imports nothing from the internal modules — enforced by the
// ESLint zone, and it needs nothing from them: the project and author come from
// the cookie on the server side, so this component sends only text.
export function FeedbackForm({
  requests,
}: {
  requests: { id: string; prompt: string }[]
}) {
  const [body, setBody] = useState('')
  const [requestId, setRequestId] = useState(requests[0]?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const text = body.trim()
    if (!text) return
    setSaving(true)
    setError(null)

    // Must be under /f: the session cookie is Path=/f, so a request to
    // /api/... would arrive without it and always 401.
    const res = await fetch('/f/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text, ...(requestId ? { requestId } : {}) }),
    })
    setSaving(false)

    if (res.ok) {
      setBody('')
      setSent(true)
      // Reload so the new entry appears in the timeline from the server, rather
      // than being optimistically stitched in on the client.
      setTimeout(() => window.location.reload(), 900)
      return
    }
    if (res.status === 401) {
      window.location.href = '/f/expired'
      return
    }
    const d = await res.json().catch(() => ({}))
    setError(d.error ?? 'Something went wrong. Please try again.')
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
        Thank you — we&apos;ve got it.
      </div>
    )
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-zinc-900">Leave feedback</h2>

      {requests.length > 1 && (
        <div className="mt-3">
          <label htmlFor="req" className="text-xs font-medium text-zinc-600">
            Responding to
          </label>
          <select
            id="req"
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            {requests.map((r) => (
              <option key={r.id} value={r.id}>
                {r.prompt.length > 70 ? `${r.prompt.slice(0, 70)}…` : r.prompt}
              </option>
            ))}
          </select>
        </div>
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        placeholder="What works, what doesn't, anything you'd like changed."
        className="mt-3 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500"
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">Only our team sees this.</p>
        <button
          type="button"
          onClick={submit}
          disabled={saving || !body.trim()}
          className="cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? 'Sending…' : 'Send feedback'}
        </button>
      </div>
    </section>
  )
}
