import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { requireInternal } from '@/lib/auth/internal'
import { serializeProject } from '@/lib/serialize'
import { ProjectDetail } from '@/components/projects/ProjectDetail'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const actor = await requireInternal()
  const { id } = await params

  const project = await db.project.findUnique({
    where: { id },
    include: { client: { select: { id: true, name: true } } },
  })
  if (!project) notFound()

  return (
    <>
      <Link
        href={`/clients/${project.client.id}`}
        className="text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← {project.client.name}
      </Link>

      <div className="mt-8">
        <ProjectDetail
          initialProject={serializeProject(project)}
          clientName={project.client.name}
          actorName={actor.name ?? actor.email}
        />
      </div>
    </>
  )
}
