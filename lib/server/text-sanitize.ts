import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { COLUMN_WIDTH, SIZE_BODY } from "@/lib/layout/constants";
import { countBulletLines, countWrappedLines } from "@/lib/layout/measure";
import { containsForbiddenTerm, extractNumbers } from "./step-validation-helpers";

export function stripForbiddenTerms(text: string, analysis: JobAnalysis): string {
  let t = text;
  const terms = (analysis.missingTerms ?? []).filter((term) => term.length >= 3);
  for (const term of terms) {
    if (!containsForbiddenTerm(t, term)) continue;
    const esc = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    t = t.replace(new RegExp(`(?<![A-Za-z0-9])${esc}(?![A-Za-z0-9])`, "gi"), " ");
  }
  return t.replace(/\s+/g, " ").trim();
}

const NUMBER_PHRASE_RE =
  /\b(?:(by|to|from|of|over|than|about|around|nearly|almost|up to|under|above)\s+)?(\d+(?:\.\d+)?(?:%|x\b|k\b|ms\b)?)(\+)?(?![A-Za-z0-9])/gi;

/** Repairs the grammar left behind after an invented number phrase was removed. */
export function tidyAfterNumberStrip(text: string): string {
  return text
    .replace(/\s+\+(?=\s|[,.;]|$)/g, "")
    .replace(/\b(by|to|from|of|over|than|about|around|nearly|almost|under|above)\s*(?=(?:and|while|with|,|;|\.|$))/gi, "")
    .replace(/\b(and|while|with|a|an|the)\s*(?=[,;.]|$)/gi, "")
    .replace(/,?\s*\b(?:a|an)\s+(?:gain|boost|improvement|increase|reduction|decrease|speedup)\b/gi, "")
    .replace(/\b(and|while)\s+(and|while)\b/gi, "$1")
    .replace(/\s+([,;.])/g, "$1")
    .replace(/([,;])\s*([,;.])/g, "$2")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Removes numbers that are not present in the source facts. Drops the whole "by 40%" / "to 200ms"
 * phrase (not just the digits) so no dangling "by +" or "latency by while" is left in the text.
 */
export function stripDisallowedNumbers(text: string, allowedFrom: string[]): string {
  const allowed = new Set(allowedFrom.flatMap(extractNumbers));
  let removed = false;
  const out = text.replace(NUMBER_PHRASE_RE, (match, _prep, core: string) => {
    if (allowed.has(core)) return match;
    removed = true;
    return "";
  });
  return removed ? tidyAfterNumberStrip(out) : out.replace(/\s+/g, " ").trim();
}

export function fitToMaxWrappedLines(
  text: string,
  maxLines: number,
  widthPt: number = COLUMN_WIDTH,
  fontSize: number = SIZE_BODY,
): string {
  let t = text.trim();
  if (!t || countWrappedLines(t, widthPt, fontSize) <= maxLines) return t;
  const words = t.split(/\s+/);
  while (words.length > 1 && countWrappedLines(words.join(" "), widthPt, fontSize) > maxLines) {
    words.pop();
  }
  return words.join(" ").trim();
}

export function fitToMaxBulletLines(text: string, maxLines: number): string {
  let t = text.trim();
  if (!t || countBulletLines(t) <= maxLines) return t;
  const words = t.split(/\s+/);
  while (words.length > 1 && countBulletLines(words.join(" ")) > maxLines) {
    words.pop();
  }
  return words.join(" ").trim();
}
