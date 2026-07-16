import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase'
import { clientInput } from '@/lib/validation'

export async function GET() {
  const { data, error } = await db.from('clients').select('*').eq('archived', false).order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ clients: data })
}

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = clientInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { data, error } = await db.from('clients').insert(parsed.data).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ client: data }, { status: 201 })
}
