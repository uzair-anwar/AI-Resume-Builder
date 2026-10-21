import "server-only";
import { cookies } from "next/headers";
import {
  COOKIE_NAME,
  createSessionToken,
  isAuthConfigured,
  shouldEnforceAuth,
  verifyPassphrase,
  verifySessionToken,
} from "@/lib/auth-core";

export async function isAuthenticated(): Promise<boolean> {
  if (!shouldEnforceAuth()) return true;
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return false;
  return verifySessionToken(token);
}

export {
  COOKIE_NAME,
  createSessionToken,
  verifyPassphrase,
  shouldEnforceAuth,
  isAuthConfigured,
  verifySessionToken,
};
