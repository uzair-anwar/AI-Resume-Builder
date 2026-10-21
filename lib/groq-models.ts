/** @deprecated use `@/lib/ai/provider-models` */
import { PROVIDER_MODEL_CATALOG, sanitizeProviderModel } from "@/lib/ai/provider-models";

export { PROVIDER_MODEL_CATALOG, defaultModelForProvider, sanitizeProviderModel } from "@/lib/ai/provider-models";

export const GROQ_MODELS = PROVIDER_MODEL_CATALOG.groq.models;
export const DEFAULT_GROQ_MODEL = PROVIDER_MODEL_CATALOG.groq.defaultModelId;

export function sanitizeGroqModel(requested?: string): string {
  return sanitizeProviderModel("groq", requested);
}
