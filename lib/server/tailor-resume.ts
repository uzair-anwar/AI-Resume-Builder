import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { JobAnalysis, TailorResponse } from "@/lib/schemas/tailoring";
import { analyzeJob } from "./analyze-job";
import { assembleResumeView, buildChanges } from "./assemble-resume";
import { getAiProvider, AiProviderError } from "./ai/provider";
import { buildTailoringSystemPrompt, buildTailoringUserPrompt, GROQ_JSON_SCHEMA } from "./prompts";
import { selectFactsForPrompt } from "./select-facts";
import { validateTailoring, type ValidationIssue } from "./validate-tailoring";

function defaultModel(): string {
  return process.env.AI_MODEL ?? "openai/gpt-oss-20b";
}

function fallbackModel(): string {
  return process.env.AI_FALLBACK_MODEL ?? "openai/gpt-oss-120b";
}

async function callWithValidation(
  resume: MasterResume,
  jobText: string,
  analysis: JobAnalysis,
  model: string,
  extraUser?: string,
) {
  const ctx = selectFactsForPrompt(resume, jobText, analysis);
  const provider = getAiProvider();
  const messages = [
    { role: "system" as const, content: buildTailoringSystemPrompt() },
    {
      role: "user" as const,
      content: buildTailoringUserPrompt(jobText, ctx, analysis) + (extraUser ? `\n\nFix these issues:\n${extraUser}` : ""),
    },
  ];

  const { raw } = await provider.completeStructured({
    messages,
    model,
    jsonSchema: GROQ_JSON_SCHEMA,
    maxTokens: 1800,
  });

  return validateTailoring(raw, resume, analysis);
}

export async function tailorResume(
  resume: MasterResume,
  jobText: string,
  roleFamilyId?: string,
): Promise<TailorResponse> {
  const analysis = analyzeJob(jobText, resume, roleFamilyId);

  let result = await callWithValidation(resume, jobText, analysis, defaultModel());
  if (!result.ok) {
    const issues = result.issues.map((i: ValidationIssue) => `${i.code}: ${i.message}`).join("\n");
    result = await callWithValidation(resume, jobText, analysis, defaultModel(), issues);
  }
  if (!result.ok) {
    result = await callWithValidation(resume, jobText, analysis, fallbackModel(), result.issues.map((i) => i.message).join("\n"));
  }
  if (!result.ok) {
    throw new AiProviderError(
      `Tailoring validation failed: ${result.issues[0]?.message ?? "unknown"}`,
      "PARSE",
    );
  }

  const resumeView = assembleResumeView(resume, result.data);
  const changes = buildChanges(resume, result.data);

  return {
    resume: resumeView,
    analysis,
    changes,
    warnings: result.data.warnings,
  };
}
