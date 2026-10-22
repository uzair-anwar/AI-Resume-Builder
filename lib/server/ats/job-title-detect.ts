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

function seniorityPrefix(defaultHeadline?: string): string {
  const h = defaultHeadline?.toLowerCase() ?? "";
  if (/\b(principal|staff)\b/.test(h)) return "Staff ";
  if (/\bsenior\b/.test(h)) return "Senior ";
  if (/\blead\b/.test(h)) return "Lead ";
  return "Senior ";
}

/**
 * JDs without a labeled title (e.g. "The Role" + full-stack delivery) still need a role line.
 */
export function inferRoleTitleFromJdContent(
  jobText: string,
  defaultHeadline?: string,
): string | undefined {
  const hay = jobText.toLowerCase();
  const prefix = seniorityPrefix(defaultHeadline);

  const fullStackPhrase = /\bfull[- ]?stack\b/.test(hay);
  const javaBackend = /\b(java|spring boot|spring)\b/.test(hay);
  const reactFront = /\breact(\s+js)?\b/.test(hay);
  const explicitSplit =
    javaBackend &&
    reactFront &&
    /\bbackend\b/.test(hay) &&
    /\bfrontend\b/.test(hay);

  if (fullStackPhrase || explicitSplit) {
    return compactRoleTitle(`${prefix}Full Stack Engineer`);
  }

  if (/\bspring boot\b/.test(hay) && /\bbackend\b/.test(hay)) {
    return compactRoleTitle(`${prefix}Software Engineer`);
  }

  if (/\bforward[- ]?deployed\b/.test(hay)) {
    return compactRoleTitle(`${prefix}Forward Deployed Engineer`);
  }

  return undefined;
}

/** Headline pattern when JD signals full-stack Java + React (Galvix-style posts). */
export function headlinePatternForJob(familyHeadline: string, jobText: string): string {
  const hay = jobText.toLowerCase();
  const fullStack =
    /\bfull[- ]?stack\b/.test(hay) ||
    (/\b(java|spring boot)\b/.test(hay) && /\breact(\s+js)?\b/.test(hay));
  if (fullStack) {
    return "Senior Full Stack Engineer";
  }
  return familyHeadline;
}
