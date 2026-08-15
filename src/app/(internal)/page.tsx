import { requireInternal } from '@/lib/auth/internal'
import { Home } from '@/components/home/Home'

// The front door. Deliberately NOT the invoice list — that was a fossil from
// when this repo was the invoicing app. A CRM's home answers "what needs me?",
// not "here is a table".
export default async function HomePage() {
  const actor = await requireInternal()
  const firstName = (actor.name ?? actor.email).split(/[\s@]/)[0]

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        {greeting()}, {firstName}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">Here&apos;s what&apos;s waiting on you.</p>
      <div className="mt-8">
        <Home />
      </div>
    </>
  )
}

function greeting(): string {
  // Server-rendered, so this is IST on Vercel (functions pinned to bom1).
  const hour = new Date().toLocaleString('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    hour12: false,
  })
  const h = Number(hour)
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
