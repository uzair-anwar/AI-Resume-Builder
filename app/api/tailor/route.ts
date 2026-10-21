import { NextResponse } from "next/server";
import { TailorRequestSchema } from "@/lib/schemas/job";
import { loadMasterResume, mergeProfileOverride } from "@/lib/server/master-resume";
import { tailorResume } from "@/lib/server/tailor-resume";
import { AiProviderError } from "@/lib/server/ai/provider";
import { deterministicTailor } from "@/lib/server/deterministic-tailor";
import { analyzeJob } from "@/lib/server/analyze-job";
import { logError, logInfo } from "@/lib/server/log";
import { PRIVATE_HEADERS } from "@/lib/api-headers";
import type { ProfileOverride } from "@/lib/schemas/profile";

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = TailorRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  const base = loadMasterResume();
  const override = parsed.data.profileOverride as ProfileOverride | undefined;
  const resume = mergeProfileOverride(base, override ?? null);

  try {
    logInfo("tailor_start");
    const result = await tailorResume(resume, parsed.data.jobDescription, parsed.data.model);
    logInfo("tailor_done");
    return NextResponse.json(result, { headers: PRIVATE_HEADERS });
  } catch (e) {
    if (e instanceof AiProviderError && e.code === "RATE_LIMIT") {
      const analysis = analyzeJob(parsed.data.jobDescription, resume);
      const fallback = deterministicTailor(resume, parsed.data.jobDescription, analysis);
      fallback.warnings.push(
        `Groq rate limit — using reordered original wording. Retry in ${e.retryAfterSec ?? 30}s.`,
      );
      return NextResponse.json(fallback, { headers: PRIVATE_HEADERS });
    }
    if (e instanceof AiProviderError) {
      logError("tailor_ai_error", { code: e.code });
      const analysis = analyzeJob(parsed.data.jobDescription, resume);
      const fallback = deterministicTailor(resume, parsed.data.jobDescription, analysis);
      fallback.warnings.push(e.message);
      return NextResponse.json(fallback, { headers: PRIVATE_HEADERS });
    }
    logError("tailor_error");
    return NextResponse.json(
      { error: "Tailoring failed" },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }
}
