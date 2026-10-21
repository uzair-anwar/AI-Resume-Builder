export const AI_PROVIDER_IDS = ["groq", "openrouter", "gemini", "cloudflare"] as const;
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export type AiProviderChoice = "auto" | AiProviderId;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type AiModelOption = { id: string; label: string };

export type AiProviderCatalog = {
  id: AiProviderId;
  label: string;
  defaultModelId: string;
  models: AiModelOption[];
};

export type StructuredChatOptions = {
  messages: ChatMessage[];
  jsonSchema: Record<string, unknown>;
  maxTokens?: number;
  model: string;
};

export type AiCallResult = { raw: unknown };

export interface TailoringAiProvider {
  meta: { id: AiProviderId; label: string };
  completeStructured(options: StructuredChatOptions): Promise<AiCallResult>;
}

export type AiErrorCode =
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "API"
  | "PARSE"
  | "AUTH"
  | "INVALID_REQUEST";

export class AiProviderError extends Error {
  constructor(
    message: string,
    public code: AiErrorCode,
    public retryAfterSec?: number,
    public providerId?: AiProviderId,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

export const PROVIDER_LABELS: Record<AiProviderId, string> = {
  groq: "Groq",
  openrouter: "OpenRouter",
  gemini: "Gemini",
  cloudflare: "Cloudflare",
};
