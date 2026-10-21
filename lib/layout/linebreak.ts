import { normalizeTypography } from "@/lib/text-normalize";
import { textWidth, type FontStyleKey } from "./fonts";

export type LayoutLine = {
  /** Units separated by (justifiable) spaces. A unit may hold several pieces glued by hyphens. */
  units: string[];
  text: string;
  last: boolean;
};

/**
 * Browser-like greedy wrap: break opportunities are spaces and positions after a hyphen.
 * Each candidate line is measured as a whole string so kerning across spaces matches the browser.
 */
export function breakLines(
  text: string,
  maxWidth: number,
  size: number,
  style: FontStyleKey = "regular",
): LayoutLine[] {
  const tokens = normalizeTypography(text).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!tokens.length) return [];

  const lines: string[][] = [];
  let units: string[] = [];

  const lineText = (u: string[]) => u.join(" ");

  for (const token of tokens) {
    const parts = token.split(/(?<=-)(?=[^-])/).filter(Boolean);
    parts.forEach((part, i) => {
      const glue = i > 0;
      if (units.length === 0) {
        units = [part];
        return;
      }
      const candidate = glue
        ? [...units.slice(0, -1), units[units.length - 1] + part]
        : [...units, part];
      if (textWidth(lineText(candidate), size, style) <= maxWidth + 0.01) {
        units = candidate;
      } else {
        lines.push(units);
        units = [part];
      }
    });
  }
  if (units.length) lines.push(units);

  return lines.map((u, i) => ({ units: u, text: lineText(u), last: i === lines.length - 1 }));
}

export function countLines(
  text: string,
  maxWidth: number,
  size: number,
  style: FontStyleKey = "regular",
): number {
  return breakLines(text, maxWidth, size, style).length;
}
