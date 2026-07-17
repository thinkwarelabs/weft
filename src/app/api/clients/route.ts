import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase'
import { clientInput } from '@/lib/validation'
import { logAudit } from '@/lib/audit'
import { pageCount, parsePagination } from '@/lib/pagination'
import { sanitizeIlike } from '@/lib/search'

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const { page, pageSize, from, to } = parsePagination(params)

  let query = db
    .from('clients')
    .select('*', { count: 'exact' })
    .eq('archived', false)
    .order('name')

  const q = sanitizeIlike(params.get('q'))
  if (q) query = query.or(`name.ilike.*${q}*,email.ilike.*${q}*`)

  const { data, error, count } = await query.range(from, to)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const total = count ?? 0
  return NextResponse.json({ clients: data, total, page, pageSize, pageCount: pageCount(total, pageSize) })
}

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = clientInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { data, error } = await db.from('clients').insert(parsed.data).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAudit({ action: 'client.create', entityType: 'client', entityId: data.id, metadata: { name: data.name } })
  return NextResponse.json({ client: data }, { status: 201 })
}
