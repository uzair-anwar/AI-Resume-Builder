import { NextResponse } from "next/server";
import { TailorRequestSchema } from "@/lib/schemas/job";
import { isAuthenticated } from "@/lib/server/auth";
import { loadMasterResume, mergeProfileOverride } from "@/lib/server/master-resume";
import { tailorResume } from "@/lib/server/tailor-resume";
import { AiProviderError } from "@/lib/server/ai/provider";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { logError, logInfo } from "@/lib/server/log";
import { PRIVATE_HEADERS } from "@/lib/api-headers";
import type { ProfileOverride } from "@/lib/schemas/profile";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: PRIVATE_HEADERS });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "local";
  const rl = checkRateLimit(`tailor:${ip}`);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: PRIVATE_HEADERS },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = TailorRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: PRIVATE_HEADERS });
  }

  const base = loadMasterResume();
  const override = parsed.data.profileOverride as ProfileOverride | undefined;
  const resume = mergeProfileOverride(base, override ?? null);

  try {
    logInfo("tailor_start");
    const result = await tailorResume(resume, parsed.data.jobDescription, parsed.data.roleFamilyId);
    logInfo("tailor_done");
    return NextResponse.json(result, { headers: PRIVATE_HEADERS });
  } catch (e) {
    if (e instanceof AiProviderError) {
      logError("tailor_ai_error", { code: e.code });
      const status = e.code === "RATE_LIMIT" ? 429 : 502;
      return NextResponse.json(
        { error: e.message, code: e.code, retryAfterSec: e.retryAfterSec },
        { status, headers: PRIVATE_HEADERS },
      );
    }
    logError("tailor_error");
    return NextResponse.json({ error: "Tailoring failed" }, { status: 500, headers: PRIVATE_HEADERS });
  }
}
