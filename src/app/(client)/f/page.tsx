import { redirect } from 'next/navigation'
import { ClientUnauthorizedError } from '@/lib/auth/client-token'
import { clientContext, clientOpenRequests, clientTimeline } from '@/lib/client-scope'
import { FeedbackForm } from '@/components/client/FeedbackForm'
import { ClientTimeline } from '@/components/client/ClientTimeline'

export const dynamic = 'force-dynamic'

// The client's entire view of the platform.
//
// Note what this page does NOT do: it takes no params, reads no query string,
// and accepts no id of any kind. Everything comes from clientContext(), which
// resolves the project from the verified cookie. There is no id to tamper with,
// so there is no IDOR to get wrong.
export default async function ClientFeedbackPage() {
  let ctx, entries, requests
  try {
    ctx = await clientContext()
    ;[entries, requests] = await Promise.all([clientTimeline(), clientOpenRequests()])
  } catch (error) {
    if (error instanceof ClientUnauthorizedError) redirect('/f/expired')
    throw error
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-sm text-zinc-500">{ctx.clientName}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
          {ctx.projectName}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Hello {ctx.contactName} — this is where you can leave feedback on the work so far.
        </p>
      </header>

      {requests.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">
            {requests.length === 1 ? 'We asked you something' : 'We asked you a few things'}
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {requests.map((r) => (
              <li key={r.id} className="text-sm text-amber-900">
                {r.prompt}
              </li>
            ))}
          </ul>
        </section>
      )}

      <FeedbackForm
        requests={requests.map((r) => ({ id: r.id, prompt: r.prompt }))}
      />

      <ClientTimeline
        entries={entries.map((e) => ({
          id: e.id,
          kind: e.kind as 'feedback' | 'milestone',
          body: e.body,
          created_at: e.createdAt.toISOString(),
          author_name: e.authorContact?.name ?? null,
        }))}
      />
    </div>
  )
}
