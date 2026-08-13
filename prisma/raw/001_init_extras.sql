-- Weft — raw SQL that Prisma's schema language cannot express.
--
-- HOW TO USE (once, when creating the init migration):
--
--   npx prisma migrate dev --create-only --name init
--   # then append the contents of THIS FILE to the generated
--   # prisma/migrations/<timestamp>_init/migration.sql
--   npx prisma migrate dev
--
-- After that this file is reference only. Never edit an applied migration;
-- write a new one.
--
-- Everything here is idempotent so it can be re-run safely while iterating.

-- ---------------------------------------------------------------------------
-- 1. business_profile is a singleton
-- ---------------------------------------------------------------------------

alter table "business_profile"
  drop constraint if exists business_profile_singleton;
alter table "business_profile"
  add constraint business_profile_singleton check (id = 1);

insert into "business_profile" (id, updated_at)
  values (1, now())
  on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Atomic invoice-number allocation
--
-- Ported verbatim from the Invoice app, where it has been correct in
-- production. UPDATE ... RETURNING takes a row lock, so two concurrent
-- finalizations can never receive the same number.
--
-- Call it with $queryRaw. NEVER increment next_invoice_number from application
-- code — a read-then-write in JS reintroduces exactly the race this avoids.
-- ---------------------------------------------------------------------------

create or replace function allocate_invoice_number()
returns text language plpgsql as $$
declare pref text; seq int;
begin
  update "business_profile"
     set next_invoice_number = next_invoice_number + 1, updated_at = now()
   where id = 1
   returning invoice_prefix, next_invoice_number - 1 into pref, seq;
  return pref || '-' || lpad(seq::text, 4, '0');
end $$;

-- ---------------------------------------------------------------------------
-- 3. Timeline author exclusivity
--
-- The whole client-scoping design rests on never confusing an internal note
-- with client-authored feedback, so this is enforced by the database rather
-- than by application discipline. An internal entry has a user and no contact;
-- a client entry has a contact and no user. There is no third state.
-- ---------------------------------------------------------------------------

alter table "timeline_entries"
  drop constraint if exists timeline_author_exclusive;
alter table "timeline_entries"
  add constraint timeline_author_exclusive check (
    (author_type = 'internal'
      and author_user_id is not null
      and author_contact_id is null)
    or
    (author_type = 'client'
      and author_contact_id is not null
      and author_user_id is null)
  );

-- Clients may only ever author feedback. An internal-only kind arriving with
-- author_type = 'client' is a bug; refuse to store it.
alter table "timeline_entries"
  drop constraint if exists timeline_client_kind;
alter table "timeline_entries"
  add constraint timeline_client_kind check (
    author_type = 'internal' or kind = 'feedback'
  );

-- ---------------------------------------------------------------------------
-- 4. Client access tokens — invariants
-- ---------------------------------------------------------------------------

alter table "client_access_tokens"
  drop constraint if exists client_token_expiry_sane;
alter table "client_access_tokens"
  add constraint client_token_expiry_sane check (expires_at > created_at);

-- NOTE: a partial index on (project_id) WHERE revoked_at IS NULL would be the
-- natural optimisation here, but Prisma cannot express partial indexes and
-- would generate a migration to drop it. The plain @@index([projectId]) on the
-- model is sufficient at this volume.

-- ---------------------------------------------------------------------------
-- 5. Full-text search vectors
--
-- GENERATED ... STORED columns: Postgres maintains them on write, so there is
-- no trigger to forget and no way for the index to drift from the row.
--
-- Prisma emits these as PLAIN tsvector columns (it only sees
-- Unsupported("tsvector")), so each is dropped and re-added as GENERATED.
-- Dropping the column drops Prisma's GIN index with it, so we recreate each one
-- USING PRISMA'S OWN INDEX NAME (<table>_search_vector_idx). Do not rename
-- them: if these differ from what Prisma derives from @@index, every future
-- `migrate dev` will generate a spurious rename migration.
-- ---------------------------------------------------------------------------

alter table "timeline_entries"
  drop column if exists search_vector;
alter table "timeline_entries"
  add column search_vector tsvector
  generated always as (to_tsvector('english', coalesce(body, ''))) stored;

create index if not exists timeline_entries_search_vector_idx
  on "timeline_entries" using gin (search_vector);

alter table "ideas"
  drop column if exists search_vector;
alter table "ideas"
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body,  '')), 'B')
  ) stored;

create index if not exists ideas_search_vector_idx
  on "ideas" using gin (search_vector);

alter table "comments"
  drop column if exists search_vector;
alter table "comments"
  add column search_vector tsvector
  generated always as (to_tsvector('english', coalesce(body, ''))) stored;

create index if not exists comments_search_vector_idx
  on "comments" using gin (search_vector);

alter table "files"
  drop column if exists search_vector;
alter table "files"
  add column search_vector tsvector
  generated always as (to_tsvector('english', coalesce(name, ''))) stored;

create index if not exists files_search_vector_idx
  on "files" using gin (search_vector);

-- A pending/absent transcript coalesces to '' — it indexes fine and simply
-- never matches until Whisper fills it in.
alter table "voice_notes"
  drop column if exists search_vector;
alter table "voice_notes"
  add column search_vector tsvector
  generated always as (to_tsvector('english', coalesce(transcript, ''))) stored;

create index if not exists voice_notes_search_vector_idx
  on "voice_notes" using gin (search_vector);

-- ---------------------------------------------------------------------------
-- 6. Row Level Security
--
-- Belt and braces, matching what the Invoice app already does. With RLS
-- enabled and NO policies defined, every non-owner role is denied everything.
-- The application connects as the table owner, which bypasses RLS, so normal
-- operation is unaffected. This exists so that if a lower-privileged
-- connection string ever leaks (a Supabase anon/publishable key, a read-only
-- role handed to some tool), it reaches nothing rather than everything.
--
-- Deliberately `enable`, NOT `force`. `force` would subject the owner to RLS
-- as well, and with no policies that locks the application out of its own
-- database. If you ever add policies, revisit this comment before adding
-- `force`.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'users', 'clients', 'client_contacts', 'projects',
    'business_profile', 'invoices', 'invoice_items', 'expenses',
    'timeline_entries', 'feedback_requests', 'client_access_tokens',
    'audit_logs', 'ideas', 'comments', 'files', 'voice_notes',
    'drive_connections'
  ]
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
