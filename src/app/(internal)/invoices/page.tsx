import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { InvoiceList } from '@/components/invoices/InvoiceList'

export default function HomePage() {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="mt-1 text-sm text-zinc-500">Create, track and download your invoices.</p>
        </div>
        <Link href="/invoices/new"><Button>New invoice</Button></Link>
      </div>
      <div className="mt-8">
        <InvoiceList />
      </div>
    </>
  )
}
