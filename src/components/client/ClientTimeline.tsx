// The client's read-only view of the project history.
//
// Receives only what lib/client-scope selected: feedback and milestones. There
// is no internal author name anywhere in this data — client-scope does not
// select authorUser at all, so an internal email cannot reach this component
// even by accident.
export function ClientTimeline({
  entries,
}: {
  entries: {
    id: string
    kind: 'feedback' | 'milestone'
    body: string
    created_at: string
    author_name: string | null
  }[]
}) {
  if (entries.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-zinc-900">History</h2>
      <ul className="flex flex-col gap-3">
        {entries.map((e) => {
          const mine = e.kind === 'feedback'
          return (
            <li
              key={e.id}
              className={`rounded-xl border p-4 ${
                mine ? 'border-zinc-200 bg-white' : 'border-blue-200 bg-blue-50'
              }`}
            >
              <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-zinc-500">
                <span className="font-medium text-zinc-700">
                  {mine ? (e.author_name ?? 'You') : 'Thinkware Labs'}
                </span>
                <span>{mine ? 'feedback' : 'update'}</span>
                <span aria-hidden>·</span>
                <time dateTime={e.created_at}>
                  {new Date(e.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </time>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-zinc-800">{e.body}</p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
