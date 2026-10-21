import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { TailorResponse } from "@/lib/schemas/tailoring";
import { readProviderEnv, resolveProviderChain } from "@/lib/ai/provider-config";
import { analyzeJob } from "./analyze-job";
import { deterministicTailor } from "./deterministic-tailor";
import { tailorResumeStagedOrFallback } from "./tailor-steps/pipeline";
import type { TailorAiOptions } from "./tailor-steps/run-ai-structured";

export type { TailorAiOptions };

export async function tailorResume(
  resume: MasterResume,
  jobText: string,
  ai: TailorAiOptions = {},
): Promise<TailorResponse> {
  const analysis = analyzeJob(jobText, resume);
  const cfg = readProviderEnv();
  const chain = resolveProviderChain(
    ai.provider ?? "auto",
    Boolean(ai.allowProviderFallback),
    cfg,
  );

  if (!chain.length) {
    const fb = deterministicTailor(resume, jobText, analysis);
    fb.warnings.push(
      "No AI provider is configured for this request. Check server environment variables.",
    );
    return fb;
  }

  return tailorResumeStagedOrFallback(resume, jobText, ai);
}
