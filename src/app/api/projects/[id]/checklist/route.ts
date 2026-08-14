import { NextResponse } from 'next/server'
import { db, json } from '@/lib/db'
import { checklistToggleInput } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { requireInternal, toResponse } from '@/lib/auth/internal'
import { serializeProject } from '@/lib/serialize'
import { checklistProgress, normalizeChecklist, setItemDone } from '@/lib/onboarding'

type Ctx = { params: Promise<{ id: string }> }

// Tick or untick one onboarding step.
//
// Read-modify-write on a JSON column, so it runs in a transaction: two people
// ticking different boxes at the same time would otherwise have one overwrite
// the other's item with a stale copy of the whole array.
export async function POST(req: Request, { params }: Ctx) {
  try {
    const actor = await requireInternal()
    const { id } = await params

    const parsed = checklistToggleInput.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }
    const { key, done } = parsed.data

    const project = await db.$transaction(async (tx) => {
      const current = await tx.project.findUnique({
        where: { id },
        select: { id: true, onboarding: true },
      })
      if (!current) return null

      const items = setItemDone(normalizeChecklist(current.onboarding), key, done, actor.id)

      return tx.project.update({
        where: { id },
        data: { onboarding: json(items) },
      })
    })

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const progress = checklistProgress(normalizeChecklist(project.onboarding))

    await logAudit({
      action: done ? 'project.checklist_done' : 'project.checklist_undone',
      entityType: 'project',
      entityId: id,
      metadata: { key, progress: `${progress.done}/${progress.total}` },
    })

    return NextResponse.json({ project: serializeProject(project) })
  } catch (error) {
    return toResponse(error)
  }
}
