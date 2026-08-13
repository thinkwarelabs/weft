-- Audit trail: who did what across the platform.
-- Rows are written by the application (see src/lib/audit.ts) since the app
-- talks to Postgres with the secret key and there is no per-request DB user,
-- so a trigger could not know the acting email.
create table if not exists audit_logs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  actor_email text,                    -- who acted (from the session); null for system actions
  action      text not null,           -- what happened, e.g. 'invoice.finalize', 'client.create'
  entity_type text,                    -- 'invoice' | 'client' | 'expense' | 'settings'
  entity_id   text,                    -- affected record id (text: covers uuid ids and settings id=1)
  metadata    jsonb,                   -- small context: { invoice_number, total, name, ... }
  ip          text                     -- best-effort request IP from headers
);

-- List view is ordered newest-first and filtered by actor / action / entity.
create index if not exists audit_logs_created_at_idx on audit_logs (created_at desc);
create index if not exists audit_logs_actor_email_idx on audit_logs (actor_email);
create index if not exists audit_logs_action_idx on audit_logs (action);
create index if not exists audit_logs_entity_idx on audit_logs (entity_type, entity_id);

-- Consistent with the other tables: block anon/publishable-key access entirely.
-- The app uses the secret key which bypasses RLS.
alter table audit_logs enable row level security;
