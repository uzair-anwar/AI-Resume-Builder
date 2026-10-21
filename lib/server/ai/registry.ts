import "server-only";
import type { AiProviderId, TailoringAiProvider } from "@/lib/ai/provider-types";
import { createGroqProvider } from "./groq";
import { createOpenRouterProvider } from "./openrouter";
import { createGeminiProvider } from "./gemini";
import { createCloudflareProvider } from "./cloudflare";

export function buildProviderRegistry(): Map<AiProviderId, TailoringAiProvider> {
  const map = new Map<AiProviderId, TailoringAiProvider>();
  const groq = createGroqProvider();
  if (groq) map.set("groq", groq);
  const or = createOpenRouterProvider();
  if (or) map.set("openrouter", or);
  const gemini = createGeminiProvider();
  if (gemini) map.set("gemini", gemini);
  const cf = createCloudflareProvider();
  if (cf) map.set("cloudflare", cf);
  return map;
}
