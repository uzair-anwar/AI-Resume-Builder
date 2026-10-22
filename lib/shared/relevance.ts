import type { JobAnalysis } from "@/lib/schemas/tailoring";

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Score how well a fact line matches JD analysis chips (higher = more relevant). */
export function scoreFactRelevance(text: string, analysis?: JobAnalysis | null): number {
  if (!analysis) return 0;
  const fact = normalizeText(text);
  let score = 0;
  for (const chip of analysis.terms) {
    const t = normalizeText(chip.term);
    if (t.length < 2) continue;
    if (!fact.includes(t)) continue;
    score += chip.status === "matched" ? 3 : chip.status === "related" ? 2 : 0;
  }
  return score;
}
