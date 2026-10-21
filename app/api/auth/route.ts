import { NextResponse } from "next/server";
import { COOKIE_NAME, createSessionToken, verifyPassphrase, shouldEnforceAuth } from "@/lib/server/auth";
import { PRIVATE_HEADERS } from "@/lib/api-headers";

export async function POST(req: Request) {
  if (!shouldEnforceAuth()) {
    const token = createSessionToken();
    const res = NextResponse.json({ ok: true, enforced: false }, { headers: PRIVATE_HEADERS });
    if (token) {
      res.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
    }
    return res;
  }

  const body = await req.json().catch(() => ({}));
  const passphrase = String(body.passphrase ?? "");
  if (!verifyPassphrase(passphrase)) {
    return NextResponse.json({ error: "Invalid passphrase" }, { status: 401, headers: PRIVATE_HEADERS });
  }

  const token = createSessionToken();
  const res = NextResponse.json({ ok: true }, { headers: PRIVATE_HEADERS });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  return res;
}
