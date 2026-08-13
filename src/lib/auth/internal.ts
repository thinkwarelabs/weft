import "server-only";
import { auth } from "@/auth";
import { env, isAuditAdmin } from "@/lib/env";
import { isInternalSession } from "@/lib/auth/identity";

// Authorization for the internal boundary.
//
// WHY THIS EXISTS: the Invoice app it grew out of relied on middleware alone —
// middleware asked "is there a session?" and 15 of 17 API routes trusted the
// answer. That was safe only because every session belonged to one of three
// trusted people. Weft has a second trust boundary, so "authenticated" and
// "authorized" are no longer the same set, and every internal entry point must
// say so for itself. Middleware is now defence in depth, not the control.
//
// CALL THIS AT THE TOP OF EVERY internal route handler and server action.
// There are no exceptions. If a route feels like it doesn't need it, it does.

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message = "Not signed in.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Forbidden.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export interface InternalActor {
  id: string;
  email: string;
  name: string | null;
}

/**
 * Assert the caller is an internal Workspace user. Returns the actor so callers
 * can attribute writes without a second `auth()` round trip.
 *
 * Throws UnauthorizedError — map it with `toResponse()` in route handlers.
 */
export async function requireInternal(): Promise<InternalActor> {
  const session = await auth();
  const user = session?.user;

  // Three independent conditions. Any one of them failing is a hard stop:
  //  - role must be explicitly "internal" (never infer from session existence)
  //  - the identity must still satisfy the current access rule
  //  - we must have a resolved DB user id to attribute writes to
  if (!user?.email || !user.id) throw new UnauthorizedError();
  if (user.role !== "internal") throw new UnauthorizedError();

  // Re-assert the same rule that ran at sign-in, against the claims carried on
  // the token. Defence in depth: a session minted under a looser configuration
  // stops working as soon as the configuration tightens, rather than living out
  // its full lifetime. Removing someone from INTERNAL_EMAILS, or switching to
  // Workspace mode, takes effect on their next request.
  const ok = isInternalSession(
    { email: user.email, hd: user.hd ?? null },
    { workspaceDomain: env.WORKSPACE_DOMAIN, allowedEmails: env.INTERNAL_EMAILS },
  );
  if (!ok) throw new UnauthorizedError();

  return { id: user.id, email: user.email, name: user.name ?? null };
}

/** Narrower capability: only AUDIT_ADMINS may read the audit trail. */
export async function requireAuditAdmin(): Promise<InternalActor> {
  const actor = await requireInternal();
  if (!isAuditAdmin(actor.email)) throw new ForbiddenError();
  return actor;
}

/**
 * Map a thrown auth error to a Response. Anything that isn't one of ours is
 * rethrown — we never turn an unexpected error into a 401, because that hides
 * bugs behind a plausible-looking status.
 */
export function toResponse(error: unknown): Response {
  if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  throw error;
}
