import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { TailorResponse } from "@/lib/schemas/tailoring";
import { fallbackChain, sanitizeGroqModel } from "@/lib/groq-models";
import { analyzeJob } from "./analyze-job";
import { assembleResumeView, buildChanges } from "./assemble-resume";
import { deterministicTailor } from "./deterministic-tailor";
import { getAiProvider, AiProviderError } from "./ai/provider";
import { buildTailoringSystemPrompt, buildTailoringUserPrompt, GROQ_JSON_SCHEMA } from "./prompts";
import { selectFactsForPrompt } from "./select-facts";
import { validateTailoring, type ValidationIssue } from "./validate-tailoring";

async function callWithValidation(
  resume: MasterResume,
  jobText: string,
  analysis: ReturnType<typeof analyzeJob>,
  model: string,
  extraUser?: string,
) {
  const ctx = selectFactsForPrompt(resume, jobText, analysis);
  const provider = getAiProvider();
  const messages = [
    { role: "system" as const, content: buildTailoringSystemPrompt() },
    {
      role: "user" as const,
      content:
        buildTailoringUserPrompt(jobText, ctx, analysis) +
        (extraUser ? `\n\nFix:\n${extraUser}` : ""),
    },
  ];

  try {
    const { raw } = await provider.completeStructured({
      messages,
      model,
      jsonSchema: GROQ_JSON_SCHEMA,
      maxTokens: 1800,
    });
    return validateTailoring(raw, resume, analysis);
  } catch (e) {
    if (e instanceof AiProviderError) throw e;
    return { ok: false as const, issues: [{ code: "API", message: "AI call failed" }] };
  }
}

export async function tailorResume(
  resume: MasterResume,
  jobText: string,
  requestedModel?: string,
): Promise<TailorResponse> {
  const analysis = analyzeJob(jobText, resume);
  const models = fallbackChain(sanitizeGroqModel(requestedModel));

  let lastIssues: ValidationIssue[] = [];
  try {
    for (const model of models) {
      let result = await callWithValidation(resume, jobText, analysis, model);
      if (!result.ok) {
        lastIssues = result.issues;
        const msg = result.issues.map((i) => `${i.code}: ${i.message}`).join("\n");
        result = await callWithValidation(resume, jobText, analysis, model, msg);
      }
      if (result.ok) {
        const resumeView = assembleResumeView(resume, result.data);
        return {
          resume: resumeView,
          analysis,
          changes: buildChanges(resume, result.data),
          warnings: [
            ...result.data.warnings,
            ...(result.repairs.count
              ? [
                  `Kept your original wording for ${result.repairs.count} item(s) that broke layout or accuracy rules.`,
                ]
              : []),
          ],
          usedFallback: false,
        };
      }
      lastIssues = result.issues;
    }
  } catch (e) {
    if (e instanceof AiProviderError) {
      const fallback = deterministicTailor(resume, jobText, analysis);
      fallback.warnings.push(e.message);
      return fallback;
    }
    throw e;
  }

  const fallback = deterministicTailor(resume, jobText, analysis);
  fallback.warnings.push(
    `AI validation failed: ${lastIssues[0]?.message ?? "unknown"}. Showing reordered original wording.`,
  );
  return fallback;
}
