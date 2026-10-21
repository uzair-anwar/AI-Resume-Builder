import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createSessionToken, verifySessionToken, shouldEnforceAuth } from "@/lib/auth-core";

describe("auth-core", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.stubEnv("ACCESS_PASSPHRASE", "test-passphrase-123");
    vi.stubEnv("AUTH_SECRET", "test-auth-secret-long-enough");
    vi.stubEnv("NODE_ENV", "development");
    delete process.env.ENFORCE_AUTH_IN_DEV;
  });

  it("round-trips session token", () => {
    const token = createSessionToken();
    expect(verifySessionToken(token)).toBe(true);
  });

  it("does not enforce auth in dev by default", () => {
    expect(shouldEnforceAuth()).toBe(false);
  });
});
