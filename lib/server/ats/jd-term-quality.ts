import "server-only";
import type { ExtractedJdTerm } from "./jd-extract";
import { classifyJdTermKind } from "./jd-dynamic-vocab";
import { findTaxonomyTermByName } from "./taxonomy";

const JUNK_START =
  /^(join(\s+us)?|when|what|write|you|your|our|this|the|at\s+a|days|if|as\s+a|in[- ]?person|customers|chalk|point\s+of|capabilities|focusing|use[- ]cases|with\s+ml|this\s+role|we\s+are|you\s+will|about\s+the|the\s+role|as\s+our|help\s+us|work\s+with)\b/i;

const JUNK_CONTAINS =
  /\b(days?\s+a\s+week|re[- ]?flexible|in[- ]?person\s+as|customers\s+and\s+prospects|write\s+code\s+to|years?\s+experience\s+of\s+professional|technical\s+and\s+non[- ]technical|what\s+we|join\s+us)\b/i;

const JUNK_END = /\b(as|and|or|the|you|we|our|in|on|at|to|with|for|a|an)$/i;

const STOP_HEAVY =
  /^(a|an|the|and|or|but|in|on|at|to|for|of|with|by|from|as|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|can|could|should|may|might|must|shall|you|your|we|our|they|their|this|that|these|those|it|its)$/i;

/** Reject sentence fragments and boilerplate so ATS scoring targets real JD vocabulary. */
export function isQualityJdTerm(term: string): boolean {
  const t = term.trim().replace(/\s+/g, " ");
  if (t.length < 2 || t.length > 48) return false;

  const lower = t.toLowerCase();
  const words = t.split(/\s+/);

  if (words.length > 6) return false;
  if (JUNK_START.test(lower) || JUNK_CONTAINS.test(lower)) return false;
  if (JUNK_END.test(lower)) return false;
  if (/[?!]/.test(t)) return false;
  if (/\.\s*$/.test(t) && words.length > 4) return false;

  if (findTaxonomyTermByName(t)) return true;

  const kind = classifyJdTermKind(t);
  if (kind === "noise") return false;

  if (words.length >= 3) {
    const stop = words.filter((w) => STOP_HEAVY.test(w.toLowerCase())).length;
    if (stop / words.length > 0.5) return false;
  }

  if (kind === "soft" || kind === "industry") return words.length <= 4;
  if (kind === "tool" || kind === "concept") return true;

  return words.length <= 3 && /[A-Z]{2,}|[.+#/-]|[a-z][A-Z]/.test(t);
}

export function filterExtractedJdTerms(terms: ExtractedJdTerm[], max = 40): ExtractedJdTerm[] {
  const kept = terms.filter((t) => isQualityJdTerm(t.term));
  const byKey = new Map<string, ExtractedJdTerm>();
  for (const t of kept) {
    const key = t.term.toLowerCase();
    const prev = byKey.get(key);
    if (!prev || t.weight > prev.weight) byKey.set(key, t);
  }
  return [...byKey.values()].sort((a, b) => b.weight - a.weight).slice(0, max);
}
