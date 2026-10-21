import "server-only";
import { isProviderCoolingDown, markProviderCooldown } from "@/lib/ai/cooldown";
import {
  isRetryableError,
  pickNextProvider,
  shouldStopAttempts,
} from "@/lib/ai/orchestrator-logic";
import { readProviderEnv } from "@/lib/ai/provider-config";
import {
  AiProviderError,
  type AiProviderId,
  type StructuredChatOptions,
  type TailoringAiProvider,
} from "@/lib/ai/provider-types";
import { buildProviderRegistry } from "./registry";

export type OrchestratorSuccess = {
  raw: unknown;
  provider: TailoringAiProvider;
  triedProviders: AiProviderId[];
};

export async function completeStructuredWithFallback(
  options: StructuredChatOptions,
  chain: AiProviderId[],
): Promise<OrchestratorSuccess> {
  const cfg = readProviderEnv();
  const registry = buildProviderRegistry();
  const startedAt = Date.now();
  let attempts = 0;
  const tried: AiProviderId[] = [];
  let lastError: AiProviderError | undefined;

  while (!shouldStopAttempts(attempts, cfg.maxAttempts, startedAt, cfg.maxElapsedMs)) {
    const nextId = pickNextProvider(chain, (id) => isProviderCoolingDown(id));
    if (!nextId) {
      break;
    }
    const provider = registry.get(nextId);
    if (!provider) {
      chain = chain.filter((id) => id !== nextId);
      continue;
    }

    attempts += 1;
    tried.push(nextId);
    try {
      const result = await provider.completeStructured(options);
      return { raw: result.raw, provider, triedProviders: tried };
    } catch (e) {
      if (!(e instanceof AiProviderError)) {
        lastError = new AiProviderError("AI call failed", "API", undefined, nextId);
        continue;
      }
      lastError = e;
      if (e.code === "RATE_LIMIT") {
        markProviderCooldown(nextId, e.retryAfterSec ?? 30);
      }
      if (!isRetryableError(e)) {
        throw e;
      }
    }
  }

  if (lastError) throw lastError;
  throw new AiProviderError(
    "All configured AI providers are unavailable or rate-limited. Try again shortly or paste your job description and use offline reordering.",
    "API",
  );
}
