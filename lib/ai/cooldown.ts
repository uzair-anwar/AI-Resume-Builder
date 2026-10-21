import type { AiProviderId } from "./provider-types";

/** Per-instance cooldown after 429 (serverless workers each have their own map). */
const until = new Map<AiProviderId, number>();

export function markProviderCooldown(id: AiProviderId, retryAfterSec: number): void {
  const ms = Math.min(Math.max(retryAfterSec, 1), 600) * 1000;
  until.set(id, Date.now() + ms);
}

export function isProviderCoolingDown(id: AiProviderId, now = Date.now()): boolean {
  const end = until.get(id);
  if (!end) return false;
  if (now >= end) {
    until.delete(id);
    return false;
  }
  return true;
}

export function clearProviderCooldown(id: AiProviderId): void {
  until.delete(id);
}

export function resetAllCooldowns(): void {
  until.clear();
}
