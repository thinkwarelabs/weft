// Shown for every refusal — revoked, expired, deactivated contact, archived
// project, or a token that never existed. Deliberately identical in all cases:
// telling a visitor which one applies is telling them what exists.
export default function ExpiredLinkPage() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
      <h1 className="text-lg font-semibold tracking-tight text-zinc-900">
        This link is no longer valid
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Feedback links expire after a couple of weeks, and can be turned off sooner. Reply to the
        email we sent and we&apos;ll send you a fresh one.
      </p>
    </div>
  )
}
