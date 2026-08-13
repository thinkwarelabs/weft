-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('onboarding', 'active', 'paused', 'closed');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'finalized', 'paid', 'cancelled');

-- CreateEnum
CREATE TYPE "PayerType" AS ENUM ('company', 'person');

-- CreateEnum
CREATE TYPE "EntryKind" AS ENUM ('note', 'feedback', 'milestone', 'status_change');

-- CreateEnum
CREATE TYPE "AuthorType" AS ENUM ('internal', 'client');

-- CreateEnum
CREATE TYPE "TokenScope" AS ENUM ('feedback');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('internal', 'client', 'system');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "billing_email" TEXT,
    "phone" TEXT,
    "tax_id" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_contacts" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "title" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'onboarding',
    "onboarding" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_profile" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "company_name" TEXT NOT NULL DEFAULT 'Thinkware Labs',
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "tax_id" TEXT,
    "legal_note" TEXT,
    "bank_account_name" TEXT,
    "bank_name" TEXT,
    "bank_account_number" TEXT,
    "bank_ifsc" TEXT,
    "bank_swift" TEXT,
    "invoice_prefix" TEXT NOT NULL DEFAULT 'TWL',
    "next_invoice_number" INTEGER NOT NULL DEFAULT 1,
    "default_currency" TEXT NOT NULL DEFAULT 'USD',
    "default_tax_label" TEXT DEFAULT 'IGST - INDIA',
    "default_tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 18,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT,
    "client_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "tax_label" TEXT,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "payment_link" TEXT,
    "notes" TEXT,
    "business_snapshot" JSONB,
    "client_snapshot" JSONB,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paid_at" TIMESTAMP(3),
    "amount_received" DECIMAL(14,2),
    "tds_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "payment_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "period" TEXT,
    "qty" DECIMAL(10,3) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gst_included" BOOLEAN NOT NULL DEFAULT true,
    "entered_unit_price" DECIMAL(14,2),
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "expense_type" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "payer_type" "PayerType" NOT NULL DEFAULT 'company',
    "payer_name" TEXT,
    "expense_date" DATE NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeline_entries" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "kind" "EntryKind" NOT NULL,
    "author_type" "AuthorType" NOT NULL,
    "author_user_id" TEXT,
    "author_contact_id" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "search_vector" tsvector,

    CONSTRAINT "timeline_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_requests" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "answer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "feedback_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_access_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "scope" "TokenScope" NOT NULL DEFAULT 'feedback',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_by_email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_type" "ActorType" NOT NULL DEFAULT 'internal',
    "actor_email" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "metadata" JSONB,
    "ip" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ideas" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "project_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "search_vector" tsvector,

    CONSTRAINT "ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "body" TEXT,
    "idea_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "search_vector" tsvector,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "drive_file_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT,
    "uploader_id" TEXT NOT NULL,
    "idea_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "search_vector" tsvector,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_notes" (
    "id" TEXT NOT NULL,
    "drive_file_id" TEXT NOT NULL,
    "duration_sec" INTEGER,
    "transcript" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idea_id" TEXT,
    "comment_id" TEXT,
    "search_vector" tsvector,

    CONSTRAINT "voice_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drive_connections" (
    "id" TEXT NOT NULL,
    "owner_email" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "vault_folder_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drive_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "clients_archived_name_idx" ON "clients"("archived", "name");

-- CreateIndex
CREATE INDEX "client_contacts_client_id_active_idx" ON "client_contacts"("client_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "client_contacts_client_id_email_key" ON "client_contacts"("client_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE INDEX "projects_client_id_status_idx" ON "projects"("client_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_client_id_idx" ON "invoices"("client_id");

-- CreateIndex
CREATE INDEX "invoices_project_id_idx" ON "invoices"("project_id");

-- CreateIndex
CREATE INDEX "invoices_status_due_date_idx" ON "invoices"("status", "due_date");

-- CreateIndex
CREATE INDEX "invoices_created_at_idx" ON "invoices"("created_at" DESC);

-- CreateIndex
CREATE INDEX "invoice_items_invoice_id_idx" ON "invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX "expenses_expense_date_idx" ON "expenses"("expense_date");

-- CreateIndex
CREATE INDEX "timeline_entries_project_id_created_at_idx" ON "timeline_entries"("project_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "timeline_entries_project_id_kind_idx" ON "timeline_entries"("project_id", "kind");

-- CreateIndex
CREATE INDEX "timeline_entries_search_vector_idx" ON "timeline_entries" USING GIN ("search_vector");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_requests_answer_id_key" ON "feedback_requests"("answer_id");

-- CreateIndex
CREATE INDEX "feedback_requests_project_id_idx" ON "feedback_requests"("project_id");

-- CreateIndex
CREATE INDEX "feedback_requests_contact_id_idx" ON "feedback_requests"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_access_tokens_token_hash_key" ON "client_access_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "client_access_tokens_project_id_idx" ON "client_access_tokens"("project_id");

-- CreateIndex
CREATE INDEX "client_access_tokens_contact_id_idx" ON "client_access_tokens"("contact_id");

-- CreateIndex
CREATE INDEX "client_access_tokens_expires_at_idx" ON "client_access_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actor_email_idx" ON "audit_logs"("actor_email");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "ideas_project_id_idx" ON "ideas"("project_id");

-- CreateIndex
CREATE INDEX "ideas_search_vector_idx" ON "ideas" USING GIN ("search_vector");

-- CreateIndex
CREATE INDEX "comments_idea_id_idx" ON "comments"("idea_id");

-- CreateIndex
CREATE INDEX "comments_search_vector_idx" ON "comments" USING GIN ("search_vector");

-- CreateIndex
CREATE UNIQUE INDEX "files_drive_file_id_key" ON "files"("drive_file_id");

-- CreateIndex
CREATE INDEX "files_idea_id_idx" ON "files"("idea_id");

-- CreateIndex
CREATE INDEX "files_search_vector_idx" ON "files" USING GIN ("search_vector");

-- CreateIndex
CREATE UNIQUE INDEX "voice_notes_idea_id_key" ON "voice_notes"("idea_id");

-- CreateIndex
CREATE UNIQUE INDEX "voice_notes_comment_id_key" ON "voice_notes"("comment_id");

-- CreateIndex
CREATE INDEX "voice_notes_search_vector_idx" ON "voice_notes" USING GIN ("search_vector");

-- CreateIndex
CREATE UNIQUE INDEX "drive_connections_owner_email_key" ON "drive_connections"("owner_email");

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_entries" ADD CONSTRAINT "timeline_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_entries" ADD CONSTRAINT "timeline_entries_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_entries" ADD CONSTRAINT "timeline_entries_author_contact_id_fkey" FOREIGN KEY ("author_contact_id") REFERENCES "client_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "client_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_requests" ADD CONSTRAINT "feedback_requests_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "timeline_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_access_tokens" ADD CONSTRAINT "client_access_tokens_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "client_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_access_tokens" ADD CONSTRAINT "client_access_tokens_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_idea_id_fkey" FOREIGN KEY ("idea_id") REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_idea_id_fkey" FOREIGN KEY ("idea_id") REFERENCES "ideas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_notes" ADD CONSTRAINT "voice_notes_idea_id_fkey" FOREIGN KEY ("idea_id") REFERENCES "ideas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_notes" ADD CONSTRAINT "voice_notes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
