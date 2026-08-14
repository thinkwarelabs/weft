import { NextResponse } from 'next/server'
import { buildInvoicePdf } from '@/lib/pdf/buildInvoicePdf'
import { requireInternal, toResponse } from '@/lib/auth/internal'

export const runtime = 'nodejs'

// This route streams a complete invoice from an id in the URL. In the Invoice
// app it had NO authorization of its own and relied entirely on middleware
// answering "is there a session?" — which was safe only while every session
// belonged to one of three trusted people. Weft has a second trust boundary,
// so it says so for itself.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireInternal()
    const { id } = await params

    const download = new URL(req.url).searchParams.get('download') === '1'

    const result = await buildInvoicePdf(id)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    return new Response(new Uint8Array(result.buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${result.filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return toResponse(error)
  }
}
