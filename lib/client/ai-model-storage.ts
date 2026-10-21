import type { AiProviderId } from "@/lib/ai/provider-types";
import { defaultModelForProvider, sanitizeProviderModel } from "@/lib/ai/provider-models";

function key(id: AiProviderId) {
  return `resume_tailor_model_${id}`;
}

export function loadModelForProvider(id: AiProviderId): string {
  if (typeof window === "undefined") return defaultModelForProvider(id);
  return sanitizeProviderModel(id, localStorage.getItem(key(id)) ?? undefined);
}

export function saveModelForProvider(id: AiProviderId, modelId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(id), sanitizeProviderModel(id, modelId));
}

export function loadAllProviderModels(
  ids: AiProviderId[],
): Partial<Record<AiProviderId, string>> {
  const out: Partial<Record<AiProviderId, string>> = {};
  for (const id of ids) out[id] = loadModelForProvider(id);
  return out;
}
