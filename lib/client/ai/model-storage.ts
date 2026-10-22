import { DEFAULT_GROQ_MODEL, sanitizeGroqModel } from "@/lib/groq-models";

const KEY = "resume_tailor_groq_model";

export function loadSelectedModel(): string {
  if (typeof window === "undefined") return DEFAULT_GROQ_MODEL;
  return sanitizeGroqModel(localStorage.getItem(KEY) ?? undefined);
}

export function saveSelectedModel(modelId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, sanitizeGroqModel(modelId));
}
