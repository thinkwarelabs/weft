create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  expense_type text,
  amount numeric not null,
  currency text not null default 'USD',
  payer_type text not null default 'company' check (payer_type in ('company','person')),
  payer_name text,
  expense_date date not null,
  note text,
  created_at timestamptz not null default now()
);
alter table expenses enable row level security;
alter table invoices add column if not exists paid_at timestamptz;
