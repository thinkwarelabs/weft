import "server-only";
import { db } from "@/lib/db";
import { readClientClaims } from "@/lib/auth/client-token";
import { CLIENT_VISIBLE_KINDS } from "@/lib/timeline";

// ---------------------------------------------------------------------------
// THE CHOKEPOINT.
//
// Every read and write performed on behalf of a client goes through a function
// in this file. Client-facing routes do NOT get a Prisma client — they get this
// small, named API, and nothing else. That is deliberate: an extended or scoped
// Prisma client still exposes `findMany` on every model, and one forgotten
// `where` is a cross-customer leak. A fixed set of functions cannot be pointed
// at the wrong table.
//
// Rules for anything added here:
//   1. Resolve projectId from readClientClaims(). NEVER take it as an argument
//      from a route handler, and never read it from the request.
//   2. Filter reads by an ALLOWLIST of what clients may see (kind: in [...]),
//      never a denylist of what they may not. New entry kinds must then be
//      explicitly opted in rather than accidentally exposed.
//   3. Never import anything from the invoicing or ideas modules. Enforced by
//      the ESLint zone in eslint.config.mjs, but know why: clients touch
//      exactly one surface.
// ---------------------------------------------------------------------------

// Allowlist of what a client may see, defined once in lib/timeline.ts and
// guarded by a test that fails closed for any unknown kind. Importing it rather
// than restating it means the two can never disagree about `note`.

export interface ClientContext {
  projectId: string;
  contactId: string;
  projectName: string;
  clientName: string;
  contactName: string;
}

/**
 * Everything a client-facing page needs to render its header, scoped to the
 * one project the cookie grants. Throws if the credential is invalid.
 */
export async function clientContext(): Promise<ClientContext> {
  const { projectId, contactId } = await readClientClaims();

  const [project, contact] = await Promise.all([
    db.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { name: true, client: { select: { name: true } } },
    }),
    db.clientContact.findUniqueOrThrow({
      where: { id: contactId },
      select: { name: true },
    }),
  ]);

  return {
    projectId,
    contactId,
    projectName: project.name,
    clientName: project.client.name,
    contactName: contact.name,
  };
}

/**
 * The project's timeline as the client sees it: their own feedback and the
 * milestones we've published. Internal notes and status changes are not
 * reachable from here — they aren't excluded, they're simply never selected.
 */
export async function clientTimeline() {
  const { projectId } = await readClientClaims();

  return db.timelineEntry.findMany({
    where: {
      projectId,
      kind: { in: [...CLIENT_VISIBLE_KINDS] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      kind: true,
      body: true,
      createdAt: true,
      authorType: true,
      authorContact: { select: { name: true } },
      // authorUser is deliberately NOT selected — a client never needs to know
      // which of us wrote a milestone, and not selecting it means an internal
      // email cannot leak through a careless serialization.
    },
  });
}

/** Any outstanding feedback requests addressed to this contact. */
export async function clientOpenRequests() {
  const { projectId, contactId } = await readClientClaims();

  return db.feedbackRequest.findMany({
    where: { projectId, contactId, respondedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, prompt: true, createdAt: true },
  });
}

/**
 * Submit feedback. The project and author are taken from the credential; the
 * caller supplies only the text and, optionally, which request it answers.
 */
export async function submitClientFeedback(input: {
  body: string;
  requestId?: string;
}) {
  const { projectId, contactId } = await readClientClaims();

  const body = input.body.trim();
  if (!body) throw new Error("Feedback cannot be empty.");
  if (body.length > 10_000) throw new Error("Feedback is too long.");

  // If this answers a request, that request must belong to THIS project and
  // THIS contact. Re-checked here rather than trusted from the form.
  let requestId: string | undefined;
  if (input.requestId) {
    const req = await db.feedbackRequest.findFirst({
      where: { id: input.requestId, projectId, contactId, respondedAt: null },
      select: { id: true },
    });
    if (!req) throw new Error("That feedback request is no longer open.");
    requestId = req.id;
  }

  return db.$transaction(async (tx) => {
    const entry = await tx.timelineEntry.create({
      data: {
        projectId,
        kind: "feedback",
        authorType: "client",
        authorContactId: contactId,
        // authorUserId intentionally omitted — the DB check constraint
        // timeline_author_exclusive rejects the row if both are set.
        body,
      },
      select: { id: true, createdAt: true },
    });

    if (requestId) {
      await tx.feedbackRequest.update({
        where: { id: requestId },
        data: { answerId: entry.id, respondedAt: entry.createdAt },
      });
    }

    await tx.auditLog.create({
      data: {
        actorType: "client",
        action: "feedback.submit",
        entityType: "timeline_entry",
        entityId: entry.id,
        metadata: { projectId, contactId },
      },
    });

    return entry;
  });
}
