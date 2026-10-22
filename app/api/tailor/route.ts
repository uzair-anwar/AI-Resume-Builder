import { NextResponse } from "next/server";
import { TailorRequestSchema } from "@/lib/schemas/job";
import { loadMasterResume, mergeProfileOverride } from "@/lib/server/resume/master-resume";
import { tailorResume } from "@/lib/server/tailor/tailor-resume";
import { deterministicTailor } from "@/lib/server/tailor/deterministic-tailor";
import { logError, logInfo } from "@/lib/server/log";
import { PRIVATE_HEADERS } from "@/lib/shared/api-headers";
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
    logInfo("tailor_start", { provider: parsed.data.provider ?? "auto" });
    const result = await tailorResume(resume, parsed.data.jobDescription, {
      provider: parsed.data.provider,
      allowProviderFallback: parsed.data.allowProviderFallback,
      providerModels: parsed.data.providerModels,
    });
    logInfo("tailor_done", { ok: !result.usedFallback });
    return NextResponse.json(result, { headers: PRIVATE_HEADERS });
  } catch (e) {
    logError("tailor_error");
    const fallback = deterministicTailor(resume, parsed.data.jobDescription);
    fallback.warnings.push(
      e instanceof Error ? e.message : "Tailoring failed. Your job description was not modified.",
    );
    return NextResponse.json(fallback, { headers: PRIVATE_HEADERS });
  }
}
