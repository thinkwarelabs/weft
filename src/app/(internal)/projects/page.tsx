import { requireInternal } from '@/lib/auth/internal'
import { ProjectsList } from '@/components/projects/ProjectsList'

// A flat view across every client — "what's live right now". Projects are still
// reached through their client too; this is the delivery-shaped way in.
export default async function ProjectsPage() {
  await requireInternal()

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
      <p className="mt-1 text-sm text-zinc-500">Every engagement, across all clients.</p>
      <div className="mt-8">
        <ProjectsList />
      </div>
    </>
  )
}
