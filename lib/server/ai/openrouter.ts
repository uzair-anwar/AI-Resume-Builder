import "server-only";
import { readProviderEnv } from "@/lib/ai/provider-config";
import { parseJsonFromModelText } from "@/lib/ai/parse-json";
import { assertOpenRouterFreeModel } from "@/lib/ai/provider-models";
import { AiProviderError, type TailoringAiProvider } from "@/lib/ai/provider-types";
import { fetchWithTimeout } from "./http";

export function createOpenRouterProvider(): TailoringAiProvider | null {
  const key = readProviderEnv().openrouter.apiKey;
  if (!key) return null;

  return {
    meta: { id: "openrouter", label: "OpenRouter" },
    async completeStructured(options) {
      assertOpenRouterFreeModel(options.model);
      const res = await fetchWithTimeout(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://resume-tailor.local",
            "X-Title": "Resume Tailor",
          },
          body: JSON.stringify({
            model: options.model,
            messages: options.messages,
            temperature: 0.2,
            max_tokens: options.maxTokens ?? 1800,
            response_format: { type: "json_object" },
          }),
        },
        { providerId: "openrouter", timeoutMs: 45_000 },
      );
      const json = await res.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") {
        throw new AiProviderError("Empty model response", "PARSE", undefined, "openrouter");
      }
      return { raw: parseJsonFromModelText(content) };
    },
  };
}
