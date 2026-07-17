import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY)

for (const t of ['business_profile', 'clients', 'invoices', 'invoice_items', 'audit_logs']) {
  // A real (non-head) select is required: a head+count query returns no error
  // for a MISSING table (count comes back null), so it silently false-passes.
  const { error } = await db.from(t).select('*').limit(1)
  if (error) { console.error(`FAIL ${t}: ${error.message}`); process.exit(1) }
  console.log(`OK table ${t}`)
}

// Read the counter first so we can put it back exactly. NEVER hardcode a value
// here: resetting to a fixed number sets the sequence behind already-issued
// invoice numbers and causes duplicate-key errors on the next finalize.
const { data: before, error: beforeErr } = await db.from('business_profile').select('next_invoice_number').eq('id', 1).single()
if (beforeErr) { console.error(`FAIL read counter: ${beforeErr.message}`); process.exit(1) }

const { data: num, error: rpcErr } = await db.rpc('allocate_invoice_number')
if (rpcErr) { console.error(`FAIL allocate_invoice_number: ${rpcErr.message}`); process.exit(1) }
console.log(`OK allocate_invoice_number -> ${num}`)

// Restore the counter to its exact pre-check value so verifying never consumes a number.
const { error: restoreErr } = await db.from('business_profile').update({ next_invoice_number: before.next_invoice_number }).eq('id', 1)
if (restoreErr) { console.error(`FAIL restore: ${restoreErr.message}`); process.exit(1) }
console.log(`OK sequence restored to ${before.next_invoice_number}`)
