import "server-only";
import { parseJsonFromModelText } from "@/lib/ai/parse-json";
import type { TailoringAiProvider } from "@/lib/ai/provider-types";
import { AiProviderError } from "@/lib/ai/provider-types";
import { readProviderEnv } from "@/lib/ai/provider-config";
import { fetchWithTimeout } from "./http";

export function createGroqProvider(): TailoringAiProvider | null {
  const key = readProviderEnv().groq.apiKey;
  if (!key) return null;

  return {
    meta: { id: "groq", label: "Groq" },
    async completeStructured(options) {
      const res = await fetchWithTimeout(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: options.model,
            messages: options.messages,
            temperature: 0.2,
            max_completion_tokens: options.maxTokens ?? 1800,
            reasoning_effort: "low",
            response_format: {
              type: "json_schema",
              json_schema: options.jsonSchema,
            },
          }),
        },
        { providerId: "groq", timeoutMs: 45_000 },
      );
      const json = await res.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") {
        throw new AiProviderError("Empty model response", "PARSE", undefined, "groq");
      }
      return { raw: parseJsonFromModelText(content) };
    },
  };
}
