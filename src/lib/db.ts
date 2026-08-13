import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/lib/env";

// Prisma 7 connects through a driver adapter rather than a `url` in the schema.
// PrismaPg takes a standard Postgres connection string (Supabase's transaction
// pooler here — migrations use DIRECT_URL instead, see prisma.config.ts).
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

// Reuse one client across hot reloads in dev so we don't exhaust connections.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// ---------------------------------------------------------------------------
// Decimal handling
//
// Money is Decimal(14,2) in Postgres — correct for an invoicing system. Prisma
// hands those back as Prisma.Decimal objects, but src/lib/money.ts and gst.ts
// (26 passing tests, ported unchanged from Invoice) operate on `number`.
//
// The rule: convert at the data-access boundary with these helpers, so the
// tested maths never has to know Decimal exists. At invoice-sized values the
// conversion is exact; float drift is an accumulate-over-millions-of-rows
// problem, and Postgres holds the authoritative rounded value regardless.
//
// Never do arithmetic on a Decimal and a number without converting first.
// ---------------------------------------------------------------------------

type DecimalLike = { toNumber(): number };

export function num(value: DecimalLike): number;
export function num(value: DecimalLike | null | undefined): number | null;
export function num(value: DecimalLike | null | undefined): number | null {
  return value == null ? null : value.toNumber();
}

/** Convert every Decimal on a row to a number, leaving other fields alone. */
export function nums<T extends Record<string, unknown>, K extends keyof T>(
  row: T,
  keys: readonly K[],
): Omit<T, K> & { [P in K]: number | null } {
  const out = { ...row } as Record<string, unknown>;
  for (const k of keys) {
    const v = row[k] as unknown as DecimalLike | null | undefined;
    out[k as string] = v == null ? null : v.toNumber();
  }
  return out as Omit<T, K> & { [P in K]: number | null };
}
