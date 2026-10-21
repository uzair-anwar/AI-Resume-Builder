import "server-only";
import { readProviderEnv } from "@/lib/ai/provider-config";
import { parseJsonFromModelText } from "@/lib/ai/parse-json";
import { AiProviderError, type TailoringAiProvider } from "@/lib/ai/provider-types";
import { fetchWithTimeout } from "./http";

export function createCloudflareProvider(): TailoringAiProvider | null {
  const { accountId, apiToken } = readProviderEnv().cloudflare;
  if (!accountId || !apiToken) return null;

  return {
    meta: { id: "cloudflare", label: "Cloudflare" },
    async completeStructured(options) {
      const model = options.model;
      const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${encodeURIComponent(model)}`;
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: options.messages.map((m) => ({
              role: m.role === "assistant" ? "assistant" : m.role,
              content: m.content,
            })),
            max_tokens: options.maxTokens ?? 1800,
            temperature: 0.2,
          }),
        },
        { providerId: "cloudflare", timeoutMs: 45_000 },
      );
      const json = await res.json();
      const text =
        json.result?.response ??
        json.result?.output ??
        (typeof json.result === "string" ? json.result : "");
      if (!text || typeof text !== "string") {
        throw new AiProviderError("Empty model response", "PARSE", undefined, "cloudflare");
      }
      return { raw: parseJsonFromModelText(text) };
    },
  };
}
