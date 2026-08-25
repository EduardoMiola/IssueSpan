import { describe, expect, it } from "vitest";
import { Authorization, AuthorizationError, createSessionToken, hashPassword, hashSessionToken, needsPasswordRehash, verifyPassword } from "./index.js";

describe("identity primitives", () => {
  it("uses Argon2id with encoded parameters and rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toContain("$argon2id$"); expect(await verifyPassword(hash, "correct horse battery staple")).toBe(true); expect(await verifyPassword(hash, "wrong")).toBe(false); expect(needsPasswordRehash(hash)).toBe(false);
  });
  it("creates an opaque 256-bit token and persists only a distinct SHA-256 hash", () => { const token = createSessionToken(); expect(Buffer.from(token, "base64url")).toHaveLength(32); expect(hashSessionToken(token)).not.toBe(token); });
  it("fails authorization closed when context is absent or role lacks a permission", () => { const authorization = new Authorization(); expect(() => authorization.require(undefined, "conversation:read")).toThrow(AuthorizationError); expect(() => authorization.require({ userId: "u", organizationId: "o", membershipId: "m", role: "AGENT" }, "member:manage")).toThrow(AuthorizationError); });
});
