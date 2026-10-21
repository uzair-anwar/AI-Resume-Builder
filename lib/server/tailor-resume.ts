import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { TailorResponse } from "@/lib/schemas/tailoring";
import { isProviderCoolingDown, markProviderCooldown } from "@/lib/ai/cooldown";
import {
  isRetryableError,
  shouldStopAttempts,
} from "@/lib/ai/orchestrator-logic";
import { readProviderEnv, resolveProviderChain } from "@/lib/ai/provider-config";
import {
  sanitizeOpenRouterModel,
  sanitizeProviderModel,
} from "@/lib/ai/provider-models";
import type { AiProviderChoice, AiProviderId } from "@/lib/ai/provider-types";
import { AiProviderError } from "@/lib/ai/provider-types";
import type { TailoringAiProvider } from "@/lib/ai/provider-types";
import { analyzeJob } from "./analyze-job";
import { assembleResumeView, buildChanges } from "./assemble-resume";
import { deterministicTailor } from "./deterministic-tailor";
import { buildTailoringSystemPrompt, buildTailoringUserPrompt, TAILORING_JSON_SCHEMA } from "./prompts";
import { selectFactsForPrompt } from "./select-facts";
import { validateTailoring, type ValidationIssue } from "./validate-tailoring";
import { buildProviderRegistry } from "./ai/registry";

export type TailorAiOptions = {
  provider?: AiProviderChoice;
  allowProviderFallback?: boolean;
  providerModels?: Partial<Record<AiProviderId, string>>;
};

function resolveModel(
  providerId: AiProviderId,
  providerModels?: Partial<Record<AiProviderId, string>>,
): string {
  const requested = providerModels?.[providerId];
  if (providerId === "openrouter") return sanitizeOpenRouterModel(requested);
  return sanitizeProviderModel(providerId, requested);
}

async function callWithValidation(
  provider: TailoringAiProvider,
  model: string,
  resume: MasterResume,
  jobText: string,
  analysis: ReturnType<typeof analyzeJob>,
  extraUser?: string,
) {
  const ctx = selectFactsForPrompt(resume, jobText, analysis);
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
      jsonSchema: TAILORING_JSON_SCHEMA,
      maxTokens: 1800,
      model,
    });
    return validateTailoring(raw, resume, analysis);
  } catch (e) {
    if (e instanceof AiProviderError) throw e;
    return { ok: false as const, issues: [{ code: "API", message: "AI call failed" }] };
  }
}

function successResponse(
  resume: MasterResume,
  analysis: ReturnType<typeof analyzeJob>,
  data: ReturnType<typeof validateTailoring> & { ok: true },
  provider: TailoringAiProvider,
  model: string,
  usedProviderFallback: boolean,
): TailorResponse {
  const resumeView = assembleResumeView(resume, data.data);
  return {
    resume: resumeView,
    analysis,
    changes: buildChanges(resume, data.data),
    warnings: [
      ...data.data.warnings,
      ...(data.repairs.count
        ? [
            `Kept your original wording for ${data.repairs.count} item(s) that broke layout or accuracy rules.`,
          ]
        : []),
    ],
    usedFallback: false,
    aiUsage: {
      provider: provider.meta.id,
      providerLabel: provider.meta.label,
      model,
      usedProviderFallback,
    },
  };
}

export async function tailorResume(
  resume: MasterResume,
  jobText: string,
  ai: TailorAiOptions = {},
): Promise<TailorResponse> {
  const analysis = analyzeJob(jobText, resume);
  const cfg = readProviderEnv();
  const choice = ai.provider ?? "auto";
  const chain = resolveProviderChain(
    choice,
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

  const registry = buildProviderRegistry();
  const startedAt = Date.now();
  let attempts = 0;
  let lastIssues: ValidationIssue[] = [];
  let lastTransportError: AiProviderError | undefined;

  for (let i = 0; i < chain.length; i++) {
    const id = chain[i];
    if (isProviderCoolingDown(id)) continue;
    const provider = registry.get(id);
    if (!provider) continue;
    const model = resolveModel(id, ai.providerModels);

    while (!shouldStopAttempts(attempts, cfg.maxAttempts, startedAt, cfg.maxElapsedMs)) {
      attempts += 1;
      try {
        let result = await callWithValidation(provider, model, resume, jobText, analysis);
        if (!result.ok) {
          lastIssues = result.issues;
          const msg = result.issues.map((x) => `${x.code}: ${x.message}`).join("\n");
          result = await callWithValidation(provider, model, resume, jobText, analysis, msg);
        }
        if (result.ok) {
          return successResponse(resume, analysis, result, provider, model, i > 0);
        }
        lastIssues = result.issues;
        break;
      } catch (e) {
        if (!(e instanceof AiProviderError)) break;
        lastTransportError = e;
        if (e.code === "RATE_LIMIT") {
          markProviderCooldown(id, e.retryAfterSec ?? 30);
        }
        if (!isRetryableError(e)) break;
        break;
      }
    }
  }

  if (lastTransportError && !isRetryableError(lastTransportError)) {
    const fb = deterministicTailor(resume, jobText, analysis);
    fb.warnings.push(lastTransportError.message);
    return fb;
  }

  const fb = deterministicTailor(resume, jobText, analysis);
  if (lastTransportError) {
    fb.warnings.push(lastTransportError.message);
  } else if (lastIssues.length) {
    fb.warnings.push(
      `AI validation failed: ${lastIssues[0]?.message ?? "unknown"}. Showing reordered original wording.`,
    );
  } else {
    fb.warnings.push(
      "All AI providers were unavailable or rate-limited. Your job description is unchanged — try again in a minute.",
    );
  }
  return fb;
}
