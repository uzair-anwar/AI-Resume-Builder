import "server-only";
import { groqProvider } from "./groq";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type StructuredChatOptions = {
  messages: ChatMessage[];
  model: string;
  jsonSchema: Record<string, unknown>;
  maxTokens?: number;
};

export type AiProviderResult = { raw: unknown };

export interface AiProvider {
  completeStructured(options: StructuredChatOptions): Promise<AiProviderResult>;
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    public code: "RATE_LIMIT" | "TIMEOUT" | "API" | "PARSE",
    public retryAfterSec?: number,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

export function getAiProvider(): AiProvider {
  return groqProvider;
}
