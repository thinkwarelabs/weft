import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY)

for (const t of ['business_profile', 'clients', 'invoices', 'invoice_items']) {
  const { error } = await db.from(t).select('*', { head: true, count: 'exact' })
  if (error) { console.error(`FAIL ${t}: ${error.message}`); process.exit(1) }
  console.log(`OK table ${t}`)
}

const { data: num, error: rpcErr } = await db.rpc('allocate_invoice_number')
if (rpcErr) { console.error(`FAIL allocate_invoice_number: ${rpcErr.message}`); process.exit(1) }
console.log(`OK allocate_invoice_number -> ${num}`)
// undo the sequence burn from the test call
const { error: resetErr } = await db.from('business_profile').update({ next_invoice_number: 1 }).eq('id', 1)
if (resetErr) { console.error(`FAIL reset: ${resetErr.message}`); process.exit(1) }
console.log('OK sequence reset to 1')
