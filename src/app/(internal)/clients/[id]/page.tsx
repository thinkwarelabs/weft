import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { requireInternal } from '@/lib/auth/internal'
import { serializeClient } from '@/lib/serialize'
import { ClientDetail } from '@/components/clients/ClientDetail'

// Server component: the client record is read here rather than fetched from the
// browser, so the page renders with data on first paint. Projects and contacts
// are loaded client-side by ClientDetail because they change as you edit them.
export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireInternal()
  const { id } = await params

  const client = await db.client.findUnique({ where: { id } })
  if (!client) notFound()

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/clients" className="text-sm text-zinc-500 hover:text-zinc-900">
            ← Clients
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{client.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {[client.city, client.country].filter(Boolean).join(', ') || 'No address on file'}
            {client.billingEmail ? ` · Invoices to ${client.billingEmail}` : ''}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <ClientDetail client={serializeClient(client)} />
      </div>
    </>
  )
}
