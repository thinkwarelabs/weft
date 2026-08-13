import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { db } from '@/lib/supabase'
import { isAuditAdmin } from '@/lib/env'
import { pageCount, parsePagination } from '@/lib/pagination'

export async function GET(req: Request) {
  const session = await auth()
  if (!isAuditAdmin(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const params = new URL(req.url).searchParams
  const { page, pageSize, from, to } = parsePagination(params)

  let query = db
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  const actor = params.get('actor')?.trim()
  const action = params.get('action')?.trim()
  const entityType = params.get('entityType')?.trim()
  if (actor) query = query.ilike('actor_email', `%${actor}%`)
  if (action) query = query.eq('action', action)
  if (entityType) query = query.eq('entity_type', entityType)

  const { data, error, count } = await query.range(from, to)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const total = count ?? 0
  return NextResponse.json({
    logs: data,
    total,
    page,
    pageSize,
    pageCount: pageCount(total, pageSize),
  })
}
