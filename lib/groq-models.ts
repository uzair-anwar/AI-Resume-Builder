export type GroqModelOption = {
  id: string;
  label: string;
};

export const GROQ_MODELS: GroqModelOption[] = [
  { id: "openai/gpt-oss-20b", label: "GPT-OSS 20B (default)" },
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
  { id: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B" },
  { id: "meta-models/muse-spark-open", label: "Muse Spark Open" },
];

export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
export const FALLBACK_GROQ_MODEL = "openai/gpt-oss-120b";

const ALLOWED = new Set(GROQ_MODELS.map((m) => m.id));

export function sanitizeGroqModel(requested?: string): string {
  if (requested && ALLOWED.has(requested)) return requested;
  return DEFAULT_GROQ_MODEL;
}

export function fallbackChain(primary: string): string[] {
  const chain = [primary];
  if (primary !== FALLBACK_GROQ_MODEL) chain.push(FALLBACK_GROQ_MODEL);
  return chain;
}
