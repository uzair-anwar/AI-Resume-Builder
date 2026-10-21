import { createHmac, timingSafeEqual } from "crypto";

export const COOKIE_NAME = "resume_tailor_session";

function getSecrets() {
  return {
    passphrase: process.env.ACCESS_PASSPHRASE ?? "",
    authSecret: process.env.AUTH_SECRET ?? "",
  };
}

export function isAuthConfigured(): boolean {
  const { passphrase, authSecret } = getSecrets();
  return passphrase.length >= 8 && authSecret.length >= 16;
}

export function shouldEnforceAuth(): boolean {
  if (process.env.NODE_ENV === "production") {
    return isAuthConfigured();
  }
  return isAuthConfigured() && process.env.ENFORCE_AUTH_IN_DEV === "1";
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(): string {
  const { passphrase, authSecret } = getSecrets();
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = `ok:${exp}`;
  const sig = sign(`${payload}:${passphrase}`, authSecret);
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): boolean {
  const { passphrase, authSecret } = getSecrets();
  if (!isAuthConfigured()) return !shouldEnforceAuth();
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = sign(`${payload}:${passphrase}`, authSecret);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    if (!timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }
  const [, expStr] = payload.split(":");
  const exp = Number(expStr);
  if (!exp || Date.now() > exp) return false;
  return payload.startsWith("ok:");
}

export function verifyPassphrase(input: string): boolean {
  const { passphrase } = getSecrets();
  if (!passphrase) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(passphrase);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
