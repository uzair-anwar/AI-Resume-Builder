import "server-only";
import type { JobAnalysis } from "@/lib/schemas/tailoring";

/** Improves title-alignment score without changing ATS math — puts JD role title in headline. */
export function alignHeadlineToJd(headline: string, analysis: JobAnalysis): string {
  const target = analysis.detectedTitle?.trim();
  if (!target || target === "Resume") return headline;

  const max = 115;
  const lower = headline.toLowerCase();
  const titleCore = target.split(/\s*[-–—|]\s*/)[0]!.trim();
  if (titleCore.length >= 4 && lower.includes(titleCore.toLowerCase().slice(0, Math.min(12, titleCore.length)))) {
    return headline.slice(0, max);
  }

  const paren = headline.includes("(") ? headline.slice(headline.indexOf("(")).trim() : "";
  const merged = paren ? `${titleCore} ${paren}` : titleCore;
  return merged.slice(0, max);
}
