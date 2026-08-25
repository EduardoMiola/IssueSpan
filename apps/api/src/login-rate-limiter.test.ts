import { describe, expect, it } from "vitest";
import { LoginRateLimiter } from "./login-rate-limiter.js";

describe("LoginRateLimiter", () => {
  it("limits one account across different IP addresses", () => {
    const limiter = new LoginRateLimiter(() => new Date("2026-08-25T12:00:00Z"));

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(limiter.isAllowed(`192.0.2.${attempt}`, "owner@example.test")).toBe(true);
    }

    expect(limiter.isAllowed("198.51.100.1", "owner@example.test")).toBe(false);
  });

  it("limits one IP across different accounts", () => {
    const limiter = new LoginRateLimiter(() => new Date("2026-08-25T12:00:00Z"));

    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(limiter.isAllowed("192.0.2.1", `user-${attempt}@example.test`)).toBe(true);
    }

    expect(limiter.isAllowed("192.0.2.1", "another@example.test")).toBe(false);
  });
});
