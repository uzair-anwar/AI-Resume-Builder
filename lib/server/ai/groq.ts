import "server-only";
import { AiProviderError, type AiProvider, type StructuredChatOptions } from "./provider";

async function groqCall(options: StructuredChatOptions): Promise<unknown> {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new AiProviderError("GROQ_API_KEY is not set", "API");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
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
    });

    if (res.status === 429) {
      const retry = Number(res.headers.get("retry-after") ?? "30");
      throw new AiProviderError("AI rate limit exceeded", "RATE_LIMIT", retry);
    }
    if (!res.ok) {
      throw new AiProviderError(`Groq API error: ${res.status}`, "API");
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new AiProviderError("Empty model response", "PARSE");
    }
    return JSON.parse(content);
  } catch (e) {
    if (e instanceof AiProviderError) throw e;
    if ((e as Error).name === "AbortError") {
      throw new AiProviderError("AI request timed out", "TIMEOUT");
    }
    throw new AiProviderError("AI request failed", "API");
  } finally {
    clearTimeout(timer);
  }
}

export const groqProvider: AiProvider = {
  async completeStructured(options) {
    const raw = await groqCall(options);
    return { raw };
  },
};
