import { describe, expect, it } from "vitest";
import {
  isInternalIdentity,
  isInternalSession,
  isWorkspaceMode,
  parseEmailList,
} from "./identity";

const ALLOWLIST = {
  allowedEmails: "shivxmsharma@gmail.com, sarthak.ai002@gmail.com",
  workspaceDomain: "",
};

const WORKSPACE = {
  allowedEmails: "shivxmsharma@gmail.com",
  workspaceDomain: "thinkwarelabs.com",
};

describe("parseEmailList", () => {
  it("trims, lowercases and drops blanks", () => {
    expect(parseEmailList(" A@x.com , ,B@X.com ")).toEqual([
      "a@x.com",
      "b@x.com",
    ]);
  });

  it("treats null/empty as an empty list", () => {
    expect(parseEmailList(null)).toEqual([]);
    expect(parseEmailList("")).toEqual([]);
  });
});

describe("isWorkspaceMode", () => {
  it("is off when the domain is empty or whitespace", () => {
    expect(isWorkspaceMode({ workspaceDomain: "" })).toBe(false);
    expect(isWorkspaceMode({ workspaceDomain: "   " })).toBe(false);
    expect(isWorkspaceMode({})).toBe(false);
  });

  it("is on when a domain is configured", () => {
    expect(isWorkspaceMode({ workspaceDomain: "thinkwarelabs.com" })).toBe(true);
  });
});

describe("allowlist mode", () => {
  it("admits a listed, verified address", () => {
    expect(
      isInternalIdentity(
        { email: "shivxmsharma@gmail.com", emailVerified: true },
        ALLOWLIST,
      ),
    ).toBe(true);
  });

  it("is case and whitespace insensitive", () => {
    expect(
      isInternalIdentity(
        { email: "  ShivxmSharma@Gmail.com ", emailVerified: true },
        ALLOWLIST,
      ),
    ).toBe(true);
  });

  it("rejects an unlisted address", () => {
    expect(
      isInternalIdentity(
        { email: "someone@gmail.com", emailVerified: true },
        ALLOWLIST,
      ),
    ).toBe(false);
  });

  it("rejects a listed address Google has not verified", () => {
    expect(
      isInternalIdentity(
        { email: "shivxmsharma@gmail.com", emailVerified: false },
        ALLOWLIST,
      ),
    ).toBe(false);
    expect(
      isInternalIdentity({ email: "shivxmsharma@gmail.com" }, ALLOWLIST),
    ).toBe(false);
  });

  it("rejects a missing address", () => {
    expect(isInternalIdentity({ emailVerified: true }, ALLOWLIST)).toBe(false);
    expect(isInternalIdentity({ email: "", emailVerified: true }, ALLOWLIST)).toBe(
      false,
    );
  });
});

describe("workspace mode", () => {
  it("admits a matching hd claim", () => {
    expect(
      isInternalIdentity(
        { email: "shivam@thinkwarelabs.com", emailVerified: true, hd: "thinkwarelabs.com" },
        WORKSPACE,
      ),
    ).toBe(true);
  });

  it("rejects a consumer account with no hd, even if allowlisted", () => {
    // This is the whole point of the exclusive-modes design: turning on
    // Workspace mode must actually close the door on the old Gmail accounts.
    expect(
      isInternalIdentity(
        { email: "shivxmsharma@gmail.com", emailVerified: true },
        WORKSPACE,
      ),
    ).toBe(false);
  });

  it("rejects a lookalike address without the hd claim", () => {
    // An address can be made to LOOK like the domain; only `hd` is asserted by
    // Google for a Workspace account.
    expect(
      isInternalIdentity(
        { email: "attacker@thinkwarelabs.com", emailVerified: true, hd: null },
        WORKSPACE,
      ),
    ).toBe(false);
  });

  it("rejects a different workspace's hd", () => {
    expect(
      isInternalIdentity(
        { email: "someone@other.com", emailVerified: true, hd: "other.com" },
        WORKSPACE,
      ),
    ).toBe(false);
  });
});

describe("isInternalSession", () => {
  it("accepts a session minted in the current mode", () => {
    expect(
      isInternalSession({ email: "shivxmsharma@gmail.com" }, ALLOWLIST),
    ).toBe(true);
    expect(
      isInternalSession(
        { email: "shivam@thinkwarelabs.com", hd: "thinkwarelabs.com" },
        WORKSPACE,
      ),
    ).toBe(true);
  });

  it("invalidates an old allowlist session once Workspace mode is turned on", () => {
    expect(
      isInternalSession({ email: "shivxmsharma@gmail.com" }, WORKSPACE),
    ).toBe(false);
  });

  it("invalidates a session for someone removed from the allowlist", () => {
    expect(
      isInternalSession({ email: "sarthak.ai002@gmail.com" }, {
        ...ALLOWLIST,
        allowedEmails: "shivxmsharma@gmail.com",
      }),
    ).toBe(false);
  });
});
