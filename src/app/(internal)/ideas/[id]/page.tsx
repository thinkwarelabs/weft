import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { requireInternal } from '@/lib/auth/internal'
import { IdeaDetail } from '@/components/ideas/IdeaDetail'

export default async function IdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireInternal()
  const { id } = await params

  const idea = await db.idea.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
    },
  })
  if (!idea) notFound()

  return (
    <>
      <Link href="/ideas" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Ideas
      </Link>

      <div className="mt-8">
        <IdeaDetail
          idea={{
            id: idea.id,
            title: idea.title,
            body: idea.body,
            created_at: idea.createdAt.toISOString(),
            author: {
              id: idea.author.id,
              name: idea.author.name ?? idea.author.email,
            },
            project: idea.project,
          }}
          actorId={actor.id}
        />
      </div>
    </>
  )
}
