import "server-only";
import { isProviderCoolingDown, markProviderCooldown } from "@/lib/ai/cooldown";
import { isRetryableError, shouldStopAttempts } from "@/lib/ai/orchestrator-logic";
import { readProviderEnv, resolveProviderChain } from "@/lib/ai/provider-config";
import { sanitizeOpenRouterModel, sanitizeProviderModel } from "@/lib/ai/provider-models";
import type { AiProviderChoice, AiProviderId, ChatMessage } from "@/lib/ai/provider-types";
import { AiProviderError } from "@/lib/ai/provider-types";
import type { z } from "zod";
import { AiUsageSchema } from "@/lib/schemas/tailoring";

type AiUsage = z.infer<typeof AiUsageSchema>;
import { buildProviderRegistry } from "../ai/registry";
import type { ValidationIssue } from "../validate-tailoring";

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

export type StructuredCallResult<T> =
  | {
      ok: true;
      data: T;
      aiUsage: AiUsage;
    }
  | {
      ok: false;
      issues: ValidationIssue[];
      message?: string;
      lastRaw?: unknown;
      aiUsage?: AiUsage;
    };

export async function runStructuredAiCall<T>(opts: {
  ai: TailorAiOptions;
  messages: ChatMessage[];
  jsonSchema: Record<string, unknown>;
  maxTokens: number;
  validate: (raw: unknown) =>
    | { ok: true; data: T }
    | { ok: false; issues: ValidationIssue[] };
  fixHint?: string;
}): Promise<StructuredCallResult<T>> {
  const cfg = readProviderEnv();
  const chain = resolveProviderChain(
    opts.ai.provider ?? "auto",
    Boolean(opts.ai.allowProviderFallback),
    cfg,
  );

  if (!chain.length) {
    return {
      ok: false,
      issues: [{ code: "NO_PROVIDER", message: "No AI provider configured" }],
      message: "No AI provider is configured.",
    };
  }

  const registry = buildProviderRegistry();
  const startedAt = Date.now();
  let attempts = 0;
  let lastIssues: ValidationIssue[] = [];
  let lastMessage: string | undefined;
  let lastRaw: unknown;
  let lastAiUsage: AiUsage | undefined;

  const messages = opts.fixHint
    ? [
        ...opts.messages,
        { role: "user" as const, content: `Fix validation errors:\n${opts.fixHint}` },
      ]
    : opts.messages;

  for (let i = 0; i < chain.length; i++) {
    const id = chain[i];
    if (isProviderCoolingDown(id)) continue;
    const provider = registry.get(id);
    if (!provider) continue;
    const model = resolveModel(id, opts.ai.providerModels);

    while (!shouldStopAttempts(attempts, cfg.maxAttempts, startedAt, cfg.maxElapsedMs)) {
      attempts += 1;
      try {
        const { raw } = await provider.completeStructured({
          messages,
          jsonSchema: opts.jsonSchema,
          maxTokens: opts.maxTokens,
          model,
        });
        lastRaw = raw;
        lastAiUsage = {
          provider: provider.meta.id,
          providerLabel: provider.meta.label,
          model,
          usedProviderFallback: i > 0,
        };
        let result = opts.validate(raw);
        for (let fix = 0; !result.ok && fix < 2; fix++) {
          lastIssues = result.issues;
          const hint = result.issues.map((x) => `${x.code}: ${x.message}`).join("\n");
          if (shouldStopAttempts(attempts, cfg.maxAttempts, startedAt, cfg.maxElapsedMs)) break;
          attempts += 1;
          const { raw: raw2 } = await provider.completeStructured({
            messages: [
              ...opts.messages,
              { role: "user", content: `Fix validation errors:\n${hint}` },
            ],
            jsonSchema: opts.jsonSchema,
            maxTokens: opts.maxTokens,
            model,
          });
          lastRaw = raw2;
          result = opts.validate(raw2);
        }
        if (result.ok) {
          return {
            ok: true,
            data: result.data,
            aiUsage: {
              provider: provider.meta.id,
              providerLabel: provider.meta.label,
              model,
              usedProviderFallback: i > 0,
            },
          };
        }
        lastIssues = result.issues;
        break;
      } catch (e) {
        if (e instanceof AiProviderError) {
          lastMessage = e.message;
          if (e.code === "RATE_LIMIT") markProviderCooldown(id, e.retryAfterSec ?? 30);
          if (!isRetryableError(e)) break;
        }
        break;
      }
    }
  }

  return {
    ok: false,
    issues: lastIssues,
    message: lastMessage ?? lastIssues[0]?.message,
    lastRaw,
    aiUsage: lastAiUsage,
  };
}
