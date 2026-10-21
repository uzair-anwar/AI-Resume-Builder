import "server-only";
import { AiProviderError, type AiErrorCode, type AiProviderId } from "@/lib/ai/provider-types";

export type HttpFailOptions = {
  providerId: AiProviderId;
  timeoutMs: number;
};

export function classifyHttpStatus(status: number): AiErrorCode {
  if (status === 401 || status === 403) return "AUTH";
  if (status === 400 || status === 404 || status === 422) return "INVALID_REQUEST";
  if (status === 429) return "RATE_LIMIT";
  if (status >= 500) return "API";
  return "API";
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  opts: HttpFailOptions,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timer);
    if (res.status === 429) {
      const retry = Number(res.headers.get("retry-after") ?? "30");
      throw new AiProviderError(
        "AI rate limit exceeded",
        "RATE_LIMIT",
        Number.isFinite(retry) ? retry : 30,
        opts.providerId,
      );
    }
    if (!res.ok) {
      const code = classifyHttpStatus(res.status);
      throw new AiProviderError(`AI HTTP ${res.status}`, code, undefined, opts.providerId);
    }
    return res;
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof AiProviderError) throw e;
    if ((e as Error).name === "AbortError") {
      throw new AiProviderError("AI request timed out", "TIMEOUT", undefined, opts.providerId);
    }
    throw new AiProviderError("AI request failed", "API", undefined, opts.providerId);
  }
}
