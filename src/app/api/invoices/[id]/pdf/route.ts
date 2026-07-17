import { NextResponse } from 'next/server'
import { buildInvoicePdf } from '@/lib/pdf/buildInvoicePdf'

export const runtime = 'nodejs'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(req.url)
  const download = url.searchParams.get('download') === '1'

  const result = await buildInvoicePdf(id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  return new Response(new Uint8Array(result.buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${result.filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
