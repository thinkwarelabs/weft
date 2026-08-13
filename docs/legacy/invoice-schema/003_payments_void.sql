alter table invoices add column if not exists amount_received numeric;
alter table invoices add column if not exists tds_amount numeric not null default 0;
alter table invoices add column if not exists payment_reference text;
alter table invoices drop constraint if exists invoices_status_check;
alter table invoices add constraint invoices_status_check
  check (status in ('draft','finalized','paid','cancelled'));
