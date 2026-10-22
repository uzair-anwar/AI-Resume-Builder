import "server-only";
import { toResumeHeadlineCase } from "@/lib/shared/format-headline";

const SECTION_HEADER_BAD =
  /^(what you|who you|about\b|the role|responsibilities|requirements|qualifications|what we|why join|how to|job description|overview|summary|description)\b/i;

const ROLE_NOUN =
  /\b(engineer|developer|architect|scientist|analyst|designer|consultant|programmer)\b/i;

/** Reject JD section headers masquerading as titles (e.g. "What you will do"). */
export function isPlausibleJobTitle(line: string): boolean {
  const t = line.trim().replace(/\s+/g, " ");
  if (t.length < 4 || t.length > 72) return false;
  if (SECTION_HEADER_BAD.test(t)) return false;
  if (/\b(will do|you will|we are looking|must have|nice to have)\b/i.test(t)) return false;
  return ROLE_NOUN.test(t);
}

/** Pull a short role title (3–6 words) from noisy JD text. */
export function extractRoleTitleFromText(raw: string): string | undefined {
  let t = raw.trim().split("\n")[0]!.trim();
  if (isPlausibleJobTitle(t)) return compactRoleTitle(t);

  const patterns = [
    /\b((?:senior|staff|principal|lead|forward[- ]deployed)\s+[\w\s/-]*?(?:engineer|developer|architect|scientist))\b/gi,
    /\b((?:full[- ]stack|fullstack|backend|frontend|ai)\s+[\w\s/-]*?(?:engineer|developer))\b/gi,
    /\b((?:software|machine learning|ml|data|platform|devops|cloud)\s+[\w\s/-]*?(?:engineer|developer|architect))\b/gi,
  ];
  for (const re of patterns) {
    const m = re.exec(raw);
    if (m?.[1] && isPlausibleJobTitle(m[1])) return compactRoleTitle(m[1]);
  }
  return undefined;
}

/** Keep seniority + role; cap length for resume headline (not filename). */
export function compactRoleTitle(raw: string, maxWords = 6): string {
  let t = raw
    .trim()
    .replace(/^position\s*title\s*:\s*/i, "")
    .replace(/^job\s*title\s*:\s*/i, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ");
  const words = t.split(/\s+/).filter((w) => w.length > 0);
  const drop = new Set(["the", "a", "an", "and", "or", "for", "with", "to", "at", "in", "on"]);
  const kept = words.filter((w, i) => i === 0 || !drop.has(w.toLowerCase()));
  return toResumeHeadlineCase(kept.slice(0, maxWords).join(" ").trim());
}

export function sanitizeDetectedJobTitle(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const extracted = extractRoleTitleFromText(raw);
  if (extracted) return extracted;
  if (isPlausibleJobTitle(raw)) return compactRoleTitle(raw);
  return undefined;
}
