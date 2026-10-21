import type { AiProviderId } from "./provider-types";

export type AiModelOption = { id: string; label: string };

export type ProviderModelCatalog = {
  defaultModelId: string;
  models: AiModelOption[];
};

/** Hardcoded allowlists — model choice is in the UI, not environment variables. */
export const PROVIDER_MODEL_CATALOG: Record<AiProviderId, ProviderModelCatalog> = {
  groq: {
    defaultModelId: "openai/gpt-oss-20b",
    models: [
      { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B (default)" },
      { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
      { id: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B" },
      { id: "meta-models/muse-spark-open", label: "Muse Spark Open" },
    ],
  },
  openrouter: {
    defaultModelId: "meta-llama/llama-3.2-3b-instruct:free",
    models: [
      { id: "meta-llama/llama-3.2-3b-instruct:free", label: "Llama 3.2 3B (free)" },
      { id: "qwen/qwen-2.5-7b-instruct:free", label: "Qwen 2.5 7B (free)" },
      { id: "google/gemma-2-9b-it:free", label: "Gemma 2 9B (free)" },
    ],
  },
  gemini: {
    defaultModelId: "gemini-2.5-flash",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (default)" },
      { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    ],
  },
  cloudflare: {
    defaultModelId: "@cf/meta/llama-3.1-8b-instruct-fp8",
    models: [
      { id: "@cf/meta/llama-3.1-8b-instruct-fp8", label: "Llama 3.1 8B FP8 (default)" },
      { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", label: "Llama 3.3 70B FP8 fast" },
    ],
  },
};

const ALLOWED: Record<AiProviderId, Set<string>> = {
  groq: new Set(PROVIDER_MODEL_CATALOG.groq.models.map((m) => m.id)),
  openrouter: new Set(PROVIDER_MODEL_CATALOG.openrouter.models.map((m) => m.id)),
  gemini: new Set(PROVIDER_MODEL_CATALOG.gemini.models.map((m) => m.id)),
  cloudflare: new Set(PROVIDER_MODEL_CATALOG.cloudflare.models.map((m) => m.id)),
};

export function defaultModelForProvider(id: AiProviderId): string {
  return PROVIDER_MODEL_CATALOG[id].defaultModelId;
}

export function sanitizeProviderModel(id: AiProviderId, requested?: string): string {
  const catalog = PROVIDER_MODEL_CATALOG[id];
  if (requested && ALLOWED[id].has(requested)) return requested;
  return catalog.defaultModelId;
}

export function assertOpenRouterFreeModel(model: string): void {
  if (!model.endsWith(":free")) {
    throw new Error("OpenRouter models must use the :free catalog variant");
  }
}

export function sanitizeOpenRouterModel(requested?: string): string {
  const model = sanitizeProviderModel("openrouter", requested);
  assertOpenRouterFreeModel(model);
  return model;
}
