import { NextResponse } from "next/server";
import { z } from "zod";
import { TailorStepPreviousSchema } from "@/lib/schemas/tailoring-steps";
import { loadMasterResume, mergeProfileOverride } from "@/lib/server/master-resume";
import { RESUME_MAX_PROJECTS } from "@/lib/layout/constants";
import { selectedProjectLabel } from "@/lib/server/project-select";
import { prepareTailoringWorkspace } from "@/lib/server/tailoring-workspace";
import { assembleResumeView, buildChanges } from "@/lib/server/assemble-resume";
import { attachAtsScorecard } from "@/lib/server/ats-score";
import { normalizeTypography as nt } from "@/lib/text-normalize";
import { applyPhraseCoverage } from "@/lib/server/phrase-coverage";
import { fitResumeViewToOnePage } from "@/lib/layout/fit-one-page";
import { finalizeResumeHeadline } from "@/lib/server/headline-align";
import { detectRoleFamily } from "@/lib/server/role-families";
import { polishTailoringResult } from "@/lib/server/polish-resume-copy";
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
  const { master: workingResume, tailoring, analysis } = prepareTailoringWorkspace(
    resume,
    parsed.data.jobDescription,
  );
  const raw = stagedToTailoringResult(parsed.data.previous, tailoring);
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
  const repaired = repairTailoring(cleaned, tailoring, analysis);
  const family = detectRoleFamily(parsed.data.jobDescription);
  const data = polishTailoringResult(
    applyPhraseCoverage(
      {
        ...repaired.data,
        headline: finalizeResumeHeadline(
          repaired.data.headline,
          analysis,
          workingResume,
          family,
        ),
      },
      workingResume,
      analysis,
    ),
    workingResume,
  );
  const report = repaired.report;
  let resumeView = assembleResumeView(tailoring, data);
  resumeView = fitResumeViewToOnePage(resumeView, analysis);
  const scoredAnalysis = attachAtsScorecard(analysis, workingResume, resumeView);

  return NextResponse.json(
    {
      resume: resumeView,
      analysis: scoredAnalysis,
      changes: buildChanges(resume, data),
      warnings: [
        ...(parsed.data.warnings ?? []),
        ...(resume.projects.length > RESUME_MAX_PROJECTS && analysis.selectedProjectIds?.length
          ? [
              `Projects on this resume (JD fit): ${selectedProjectLabel(workingResume, analysis.selectedProjectIds)}.`,
            ]
          : []),
        ...(report.count
          ? [`Layout guardrails adjusted ${report.count} item(s) to fit the one-page template.`]
          : []),
      ],
      aiUsage: parsed.data.aiUsage,
    },
    { headers: PRIVATE_HEADERS },
  );
}
