import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import {
  CLIENT_REFUSAL_MESSAGE,
  evaluateAccess,
  isAllowed,
  type AccessDecision,
} from '@/lib/auth/client-access'

// ---------------------------------------------------------------------------
// Boundary 2 of 2: clients.
//
// Deliberately NOT NextAuth. Auth.js's magic-link provider is an IDENTITY
// mechanism — clicking the link creates a user and a session, which says "you
// are a user of this application". A client needs a CAPABILITY: "the holder may
// leave feedback on project X, until <date>". Conflating them is how a client
// ends up holding a credential that satisfies every `if (session.user)` check
// in the codebase.
//
// Invariants, in order of how badly it goes if you break one:
//
//  1. NO CLIENT-FACING ROUTE TAKES A RESOURCE ID. Not in the path, not in the
//     query, not in the body. The project is read from the verified cookie and
//     nowhere else. No id in the URL means no IDOR to get wrong.
//  2. The raw token is never stored, never logged, and never survives past the
//     one-time exchange redirect.
//  3. The cookie is Path=/f, so the browser will not attach it to /api/invoices
//     or anything else, even by accident.
//  4. CLIENT_TOKEN_SECRET is not AUTH_SECRET. Enforced at boot in env.ts.
//  5. The token row is re-read on EVERY request. The cookie says which row to
//     look at; it never says what the holder may do.
// ---------------------------------------------------------------------------

const COOKIE_NAME = 'weft_client'
const COOKIE_PATH = '/f'
const AUDIENCE = 'weft:client'
const ISSUER = 'weft'

/** How long a mailed link stays usable. */
export const TOKEN_TTL_DAYS = 14
/** How long a browser stays signed in after exchanging one. */
export const COOKIE_TTL_HOURS = 24

const secret = new TextEncoder().encode(env.CLIENT_TOKEN_SECRET)

export interface ClientClaims {
  /** ClientAccessToken.id — re-checked against the database every request. */
  tid: string
  /** The scope. Everything client-facing is filtered by this. */
  projectId: string
  contactId: string
}

export class ClientUnauthorizedError extends Error {
  readonly status = 401
  readonly decision: AccessDecision
  constructor(decision: AccessDecision = 'not_found') {
    // One message for every refusal. The difference between revoked, expired
    // and never-existed is information about what exists.
    super(CLIENT_REFUSAL_MESSAGE)
    this.name = 'ClientUnauthorizedError'
    this.decision = decision
  }
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

// Everything evaluateAccess needs, in one shape, from one query.
const ACCESS_SELECT = {
  id: true,
  projectId: true,
  contactId: true,
  scope: true,
  expiresAt: true,
  revokedAt: true,
  contact: { select: { active: true } },
  project: { select: { archivedAt: true } },
} as const

type AccessRow = {
  id: string
  projectId: string
  contactId: string
  scope: string
  expiresAt: Date
  revokedAt: Date | null
  contact: { active: boolean }
  project: { archivedAt: Date | null }
}

function snapshot(row: AccessRow) {
  return {
    scope: row.scope,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    contactActive: row.contact.active,
    projectArchivedAt: row.project.archivedAt,
  }
}

// --- minting -------------------------------------------------------------

/**
 * Mint a feedback link for one contact on one project.
 *
 * Returns the raw token EXACTLY ONCE. Put it straight into the email body and
 * let it go out of scope — never persist it, never log it, never return it in
 * an API response that might be cached.
 */
export async function mintClientToken(params: {
  contactId: string
  projectId: string
  createdByEmail: string
  ttlDays?: number
}): Promise<{ url: string; tokenId: string; expiresAt: Date }> {
  const raw = randomBytes(32).toString('base64url')
  const expiresAt = new Date(
    Date.now() + (params.ttlDays ?? TOKEN_TTL_DAYS) * 24 * 60 * 60 * 1000,
  )

  // The contact must belong to the same client as the project. A mismatch means
  // something upstream built a link across two customers — refuse rather than
  // mint it and rely on later checks.
  const [contact, project] = await Promise.all([
    db.clientContact.findUnique({
      where: { id: params.contactId },
      select: { clientId: true, active: true },
    }),
    db.project.findUnique({
      where: { id: params.projectId },
      select: { clientId: true, archivedAt: true },
    }),
  ])

  if (!contact?.active) throw new Error('Contact not found or inactive.')
  if (!project || project.archivedAt) throw new Error('Project not found or archived.')
  if (contact.clientId !== project.clientId) {
    throw new Error('Refusing to mint: contact and project belong to different clients.')
  }

  const row = await db.clientAccessToken.create({
    data: {
      tokenHash: hashToken(raw),
      contactId: params.contactId,
      projectId: params.projectId,
      scope: 'feedback',
      expiresAt,
      createdByEmail: params.createdByEmail,
    },
    select: { id: true },
  })

  return {
    url: `${env.APP_URL.replace(/\/$/, '')}/f/${raw}`,
    tokenId: row.id,
    expiresAt,
  }
}

/** Revoke a link. Takes effect on the holder's very next request. */
export async function revokeClientToken(tokenId: string): Promise<void> {
  await db.clientAccessToken.updateMany({
    where: { id: tokenId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

// --- exchange ------------------------------------------------------------

/**
 * Exchange a raw token from the URL for a scoped cookie.
 *
 * Called once, by /f/[token], which then redirects to /f so the raw token
 * leaves the address bar and stops leaking through the Referer header.
 */
export async function exchangeToken(raw: string): Promise<ClientClaims> {
  const row = (await db.clientAccessToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    select: ACCESS_SELECT,
  })) as AccessRow | null

  const decision = evaluateAccess(row ? snapshot(row) : null)
  if (!isAllowed(decision) || !row) throw new ClientUnauthorizedError(decision)

  await db.clientAccessToken.update({
    where: { id: row.id },
    data: { lastUsedAt: new Date() },
  })

  const claims: ClientClaims = {
    tid: row.id,
    projectId: row.projectId,
    contactId: row.contactId,
  }

  const jwt = await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_TTL_HOURS}h`)
    .sign(secret)

  const jar = await cookies()
  jar.set(COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    // The important one. Path scoping means the browser never sends this cookie
    // to /api/invoices, /ideas, or anything else outside /f.
    path: COOKIE_PATH,
    maxAge: COOKIE_TTL_HOURS * 60 * 60,
  })

  return claims
}

/**
 * Read and fully re-validate the current client's claims.
 *
 * A valid signature is NOT sufficient. The token row is re-read every request,
 * so revoking a link, deactivating a contact, or archiving a project takes
 * effect immediately rather than whenever the cookie happens to expire.
 */
export async function readClientClaims(): Promise<ClientClaims> {
  const jar = await cookies()
  const rawCookie = jar.get(COOKIE_NAME)?.value
  if (!rawCookie) throw new ClientUnauthorizedError()

  let tid: string
  try {
    const { payload } = await jwtVerify(rawCookie, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
    })
    tid = (payload as { tid?: string }).tid ?? ''
  } catch {
    throw new ClientUnauthorizedError()
  }
  if (!tid) throw new ClientUnauthorizedError()

  const row = (await db.clientAccessToken.findUnique({
    where: { id: tid },
    select: ACCESS_SELECT,
  })) as AccessRow | null

  const decision = evaluateAccess(row ? snapshot(row) : null)
  if (!isAllowed(decision) || !row) throw new ClientUnauthorizedError(decision)

  // Scope comes from the DATABASE, not the cookie. If the two ever disagree,
  // the cookie is the untrusted input and the row wins.
  return { tid: row.id, projectId: row.projectId, contactId: row.contactId }
}

export async function clearClientCookie(): Promise<void> {
  const jar = await cookies()
  jar.set(COOKIE_NAME, '', { path: COOKIE_PATH, maxAge: 0 })
}

export const CLIENT_COOKIE_NAME = COOKIE_NAME
