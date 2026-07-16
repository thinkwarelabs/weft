'use client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { formatDateLong } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { Client, Invoice } from '@/lib/types'

export function InvoiceDetail({ id }: { id: string }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState<'finalize' | 'paid' | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const downloaded = useRef(false)

  const pdfUrl = `/api/invoices/${id}/pdf`

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setInvoice(d.invoice); setClient(d.client) })
      .catch(() => setNotFound(true))
  }, [id])

  // auto-download once for freshly finalized invoices
  useEffect(() => {
    if (searchParams.get('autodownload') === '1' && !downloaded.current) {
      downloaded.current = true
      const a = document.createElement('a')
      a.href = `${pdfUrl}?download=1`
      document.body.appendChild(a)
      a.click()
      a.remove()
      router.replace(`/invoices/${id}`, { scroll: false })
    }
  }, [searchParams, pdfUrl, id, router])

  if (notFound) return <p className="py-20 text-center text-sm text-zinc-500">Invoice not found.</p>
  if (!invoice) return <div className="flex min-h-[60vh] items-center justify-center"><Spinner className="size-10 text-zinc-400" /></div>

  async function post(path: 'finalize' | 'mark-paid', kind: 'finalize' | 'paid') {
    setBusy(kind)
    const res = await fetch(`/api/invoices/${id}/${path}`, { method: 'POST' })
    setBusy(null)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) return toast(d.error ?? 'Something went wrong', 'error')
    setInvoice(d.invoice)
    if (kind === 'finalize') {
      toast(`Invoice ${d.invoice.invoice_number} finalized`)
      const a = document.createElement('a')
      a.href = `${pdfUrl}?download=1`
      document.body.appendChild(a); a.click(); a.remove()
    } else {
      toast('Marked as paid')
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{invoice.invoice_number ?? 'Draft invoice'}</h1>
            <Badge status={invoice.status} />
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {client?.name} · {formatMoney(Number(invoice.total), invoice.currency)} · due {formatDateLong(invoice.due_date)}
          </p>
        </div>
        <div className="flex gap-2">
          {invoice.status === 'draft' && (
            <>
              <Link href={`/invoices/${id}/edit`}><Button variant="secondary">Edit</Button></Link>
              <Button loading={busy === 'finalize'} onClick={() => post('finalize', 'finalize')}>Finalize</Button>
            </>
          )}
          {invoice.status === 'finalized' && (
            <Button variant="secondary" loading={busy === 'paid'} onClick={() => post('mark-paid', 'paid')}>Mark paid</Button>
          )}
          <a href={`${pdfUrl}?download=1`}><Button>Download PDF</Button></a>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <iframe
          key={invoice.status} // re-render preview after finalize (number appears)
          src={`${pdfUrl}#toolbar=0&navpanes=0`}
          className="h-[75vh] w-full"
          title="Invoice PDF preview"
        />
      </div>
    </div>
  )
}
