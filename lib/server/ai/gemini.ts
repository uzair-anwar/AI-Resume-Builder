import "server-only";
import { readProviderEnv } from "@/lib/ai/provider-config";
import { parseJsonFromModelText } from "@/lib/ai/parse-json";
import { AiProviderError, type TailoringAiProvider } from "@/lib/ai/provider-types";
import { fetchWithTimeout } from "./http";

export function createGeminiProvider(): TailoringAiProvider | null {
  const key = readProviderEnv().gemini.apiKey;
  if (!key) return null;

  return {
    meta: { id: "gemini", label: "Gemini" },
    async completeStructured(options) {
      const model = options.model;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
      const res = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: options.messages
              .filter((m) => m.role !== "system")
              .map((m) => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }],
              })),
            systemInstruction: {
              parts: [
                {
                  text: options.messages.find((m) => m.role === "system")?.content ?? "",
                },
              ],
            },
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: options.maxTokens ?? 1800,
              responseMimeType: "application/json",
            },
          }),
        },
        { providerId: "gemini", timeoutMs: 45_000 },
      );
      const json = await res.json();
      const parts = json.candidates?.[0]?.content?.parts;
      const text = parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
      if (!text) {
        throw new AiProviderError("Empty model response", "PARSE", undefined, "gemini");
      }
      return { raw: parseJsonFromModelText(text) };
    },
  };
}
