create table if not exists business_profile (
  id int primary key check (id = 1),
  company_name text not null default 'Thinkware Labs',
  address_line1 text, address_line2 text,
  city text, state text, postal_code text, country text,
  email text, phone text,
  tax_id text, legal_note text,
  bank_account_name text, bank_name text, bank_account_number text,
  bank_ifsc text, bank_swift text,
  invoice_prefix text not null default 'TWL',
  next_invoice_number int not null default 1,
  default_currency text not null default 'USD',
  default_tax_label text default 'IGST - INDIA',
  default_tax_rate numeric not null default 18,
  updated_at timestamptz not null default now()
);

insert into business_profile (id) values (1) on conflict do nothing;

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address_line1 text, address_line2 text,
  city text, state text, postal_code text, country text,
  email text, phone text, tax_id text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique,
  client_id uuid not null references clients(id),
  issue_date date not null,
  due_date date not null,
  status text not null default 'draft' check (status in ('draft','finalized','paid')),
  currency text not null default 'USD',
  tax_label text,
  tax_rate numeric not null default 0,
  payment_link text,
  notes text,
  business_snapshot jsonb,
  client_snapshot jsonb,
  subtotal numeric not null default 0,
  tax_amount numeric not null default 0,
  total numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null,
  period text,
  qty numeric not null default 1,
  unit_price numeric not null default 0,
  amount numeric not null default 0,
  sort_order int not null default 0
);

-- Atomically claim the next invoice number, e.g. 'TWL-0012'
create or replace function allocate_invoice_number()
returns text language plpgsql as $$
declare pref text; seq int;
begin
  update business_profile
     set next_invoice_number = next_invoice_number + 1, updated_at = now()
   where id = 1
   returning invoice_prefix, next_invoice_number - 1 into pref, seq;
  return pref || '-' || lpad(seq::text, 4, '0');
end $$;

-- Block anon/publishable-key access entirely; the app uses the secret key which bypasses RLS.
alter table business_profile enable row level security;
alter table clients enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
