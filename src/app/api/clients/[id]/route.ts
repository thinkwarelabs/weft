import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase'
import { clientInput } from '@/lib/validation'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const archived = typeof body.archived === 'boolean' ? body.archived : undefined
  const parsed = clientInput.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const update = { ...parsed.data, ...(archived !== undefined ? { archived } : {}) }
  const { data, error } = await db.from('clients').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ client: data })
}
