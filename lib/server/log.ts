import "server-only";

export function logInfo(event: string, meta?: Record<string, string | number | boolean>) {
  const safe = meta ? JSON.stringify(meta) : "";
  console.log(`[resume-tailor] ${event} ${safe}`);
}

export function logError(event: string, meta?: Record<string, string | number | boolean>) {
  const safe = meta ? JSON.stringify(meta) : "";
  console.error(`[resume-tailor] ${event} ${safe}`);
}
