import {
  AI_PROVIDER_IDS,
  type AiProviderId,
  PROVIDER_LABELS,
  type AiProviderCatalog,
} from "./provider-types";
import { PROVIDER_MODEL_CATALOG } from "./provider-models";

export type ProviderEnvConfig = {
  groq: { apiKey?: string };
  openrouter: { apiKey?: string };
  gemini: { apiKey?: string };
  cloudflare: { accountId?: string; apiToken?: string };
  fallbackOrder: AiProviderId[];
  maxElapsedMs: number;
  maxAttempts: number;
};

export function parseFallbackOrder(raw: string | undefined): AiProviderId[] {
  const parts = (raw ?? "groq,openrouter,gemini,cloudflare")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const out: AiProviderId[] = [];
  for (const p of parts) {
    if (AI_PROVIDER_IDS.includes(p as AiProviderId) && !out.includes(p as AiProviderId)) {
      out.push(p as AiProviderId);
    }
  }
  return out.length ? out : ["groq"];
}

export function readProviderEnv(
  env: Record<string, string | undefined> = process.env,
): ProviderEnvConfig {
  return {
    groq: { apiKey: env.GROQ_API_KEY?.trim() || undefined },
    openrouter: { apiKey: env.OPENROUTER_API_KEY?.trim() || undefined },
    gemini: { apiKey: env.GEMINI_API_KEY?.trim() || undefined },
    cloudflare: {
      accountId: env.CLOUDFLARE_ACCOUNT_ID?.trim() || undefined,
      apiToken: env.CLOUDFLARE_API_TOKEN?.trim() || undefined,
    },
    fallbackOrder: parseFallbackOrder(env.AI_FALLBACK_ORDER),
    maxElapsedMs: Number(env.AI_MAX_ELAPSED_MS ?? "25000") || 25000,
    maxAttempts: Number(env.AI_MAX_ATTEMPTS ?? "6") || 6,
  };
}

export function isProviderConfigured(id: AiProviderId, cfg: ProviderEnvConfig): boolean {
  switch (id) {
    case "groq":
      return Boolean(cfg.groq.apiKey);
    case "openrouter":
      return Boolean(cfg.openrouter.apiKey);
    case "gemini":
      return Boolean(cfg.gemini.apiKey);
    case "cloudflare":
      return Boolean(cfg.cloudflare.accountId && cfg.cloudflare.apiToken);
    default:
      return false;
  }
}

export function listConfiguredProviders(cfg: ProviderEnvConfig): AiProviderCatalog[] {
  const metas: AiProviderCatalog[] = [];
  for (const id of AI_PROVIDER_IDS) {
    if (!isProviderConfigured(id, cfg)) continue;
    const catalog = PROVIDER_MODEL_CATALOG[id];
    metas.push({
      id,
      label: PROVIDER_LABELS[id],
      defaultModelId: catalog.defaultModelId,
      models: catalog.models,
    });
  }
  return metas;
}

export function resolveProviderChain(
  choice: "auto" | AiProviderId,
  allowFallback: boolean,
  cfg: ProviderEnvConfig,
): AiProviderId[] {
  const configured = new Set(
    listConfiguredProviders(cfg).map((p) => p.id),
  );

  const filterConfigured = (ids: AiProviderId[]) =>
    ids.filter((id) => configured.has(id));

  if (choice === "auto") {
    return filterConfigured(cfg.fallbackOrder);
  }

  if (!configured.has(choice)) return [];

  const chain = [choice];
  if (!allowFallback) return chain;

  for (const id of cfg.fallbackOrder) {
    if (id === choice) continue;
    if (!configured.has(id)) continue;
    chain.push(id);
  }
  return chain;
}

export const GEMINI_FREE_TIER_WARNING =
  "Google’s free Gemini API tier may use your prompts to improve Google’s products. Only enable Gemini if you accept that for resume and job-description text.";
