import type { AiProviderChoice } from "@/lib/ai/provider-types";

const PROVIDER_KEY = "resume_tailor_ai_provider";
const FALLBACK_KEY = "resume_tailor_ai_fallback";
const GEMINI_KEY = "resume_tailor_gemini_opt_in";

export function loadAiProviderChoice(): AiProviderChoice {
  if (typeof window === "undefined") return "auto";
  const v = localStorage.getItem(PROVIDER_KEY);
  if (v === "groq" || v === "openrouter" || v === "gemini" || v === "cloudflare" || v === "auto") {
    return v;
  }
  return "auto";
}

export function saveAiProviderChoice(choice: AiProviderChoice) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROVIDER_KEY, choice);
}

export function loadAllowProviderFallback(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(FALLBACK_KEY) === "1";
}

export function saveAllowProviderFallback(on: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(FALLBACK_KEY, on ? "1" : "0");
}

export function loadGeminiOptIn(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(GEMINI_KEY) === "1";
}

export function saveGeminiOptIn(on: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(GEMINI_KEY, on ? "1" : "0");
}
