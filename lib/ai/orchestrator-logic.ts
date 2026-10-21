import type { AiProviderError, AiProviderId } from "./provider-types";

export function isRetryableError(err: AiProviderError): boolean {
  if (err.code === "AUTH" || err.code === "INVALID_REQUEST" || err.code === "PARSE") {
    return false;
  }
  return err.code === "RATE_LIMIT" || err.code === "TIMEOUT" || err.code === "API";
}

export function pickNextProvider(
  chain: AiProviderId[],
  cooling: (id: AiProviderId) => boolean,
): AiProviderId | undefined {
  return chain.find((id) => !cooling(id));
}

export function shouldStopAttempts(
  attempt: number,
  maxAttempts: number,
  startedAt: number,
  maxElapsedMs: number,
  now = Date.now(),
): boolean {
  if (attempt >= maxAttempts) return true;
  if (now - startedAt >= maxElapsedMs) return true;
  return false;
}
