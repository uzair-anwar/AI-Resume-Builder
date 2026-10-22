import { NextResponse } from "next/server";
import { z } from "zod";
import { TailorStepPreviousSchema } from "@/lib/schemas/tailoring-steps";
import { loadMasterResume, mergeProfileOverride } from "@/lib/server/master-resume";
import { mergeResumeWithExpansionSkills } from "@/lib/server/ats-expansion";
import { analyzeJob } from "@/lib/server/analyze-job";
import { assembleResumeView, buildChanges } from "@/lib/server/assemble-resume";
import { attachAtsScorecard } from "@/lib/server/ats-score";
import { normalizeTypography as nt } from "@/lib/text-normalize";
import { applyPhraseCoverage } from "@/lib/server/phrase-coverage";
import { fitResumeViewToOnePage } from "@/lib/layout/fit-one-page";
import { alignHeadlineToJd } from "@/lib/server/headline-align";
import { repairTailoring } from "@/lib/server/validate-tailoring";
import { stagedToTailoringResult } from "@/lib/server/tailor-steps/run-step";
import { PRIVATE_HEADERS } from "@/lib/api-headers";
import type { ProfileOverride } from "@/lib/schemas/profile";

const BodySchema = z.object({
  jobDescription: z.string().min(50),
  previous: TailorStepPreviousSchema,
  profileOverride: z.record(z.string(), z.unknown()).optional(),
  warnings: z.array(z.string()).optional(),
  aiUsage: z
    .object({
      provider: z.enum(["groq", "openrouter", "gemini", "cloudflare"]),
      providerLabel: z.string(),
      model: z.string(),
      usedProviderFallback: z.boolean().optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers: PRIVATE_HEADERS });
  }

  const base = loadMasterResume();
  const override = parsed.data.profileOverride as ProfileOverride | undefined;
  const resume = mergeProfileOverride(base, override ?? null);
  const analysis = analyzeJob(parsed.data.jobDescription, resume);
  const workingResume = mergeResumeWithExpansionSkills(resume, analysis);
  const raw = stagedToTailoringResult(parsed.data.previous, workingResume);
  const cleaned = {
    ...raw,
    headline: nt(raw.headline),
    summary: nt(raw.summary),
    experience: raw.experience.map((e) => ({
      ...e,
      bullets: e.bullets.map((b) => ({ ...b, text: nt(b.text) })),
    })),
    projects: raw.projects.map((p) => ({ ...p, description: nt(p.description) })),
  };
  const repaired = repairTailoring(cleaned, workingResume, analysis);
  const data = applyPhraseCoverage(
    {
      ...repaired.data,
      headline: alignHeadlineToJd(repaired.data.headline, analysis),
    },
    workingResume,
    analysis,
  );
  const report = repaired.report;
  let resumeView = assembleResumeView(workingResume, data);
  resumeView = fitResumeViewToOnePage(resumeView, analysis);
  const scoredAnalysis = attachAtsScorecard(analysis, workingResume, resumeView);

  return NextResponse.json(
    {
      resume: resumeView,
      analysis: scoredAnalysis,
      changes: buildChanges(resume, data),
      warnings: [
        ...(parsed.data.warnings ?? []),
        ...(report.count
          ? [`Layout guardrails adjusted ${report.count} item(s) to fit the one-page template.`]
          : []),
      ],
      aiUsage: parsed.data.aiUsage,
    },
    { headers: PRIVATE_HEADERS },
  );
}
