import type { AiProviderCatalog, AiProviderChoice, AiProviderId } from "@/lib/ai/provider-types";

export type PipelineKeyInput = {
  /** Master resume the result is generated from (different master = different result). */
  masterId?: string;
  jobUrl: string;
  jobDescription: string;
  provider: AiProviderChoice;
  allowFallback: boolean;
  modelsByProvider: Partial<Record<AiProviderId, string>>;
  serverProviders: AiProviderCatalog[];
};

export function buildPipelineKey(input: PipelineKeyInput): string {
  const providerModels = Object.fromEntries(
    input.serverProviders.map((p) => [
      p.id,
      input.modelsByProvider[p.id] ?? p.defaultModelId,
    ]),
  );
  return JSON.stringify({
    masterId: input.masterId ?? "",
    jobUrl: input.jobUrl.trim(),
    jobDescription: input.jobDescription,
    provider: input.provider,
    allowFallback: input.allowFallback,
    providerModels,
  });
}
