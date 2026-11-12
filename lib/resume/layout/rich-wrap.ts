import { normalizeTypography } from "@/lib/shared/text-normalize";
import { hasRichMarkup, parseRichText, type RichSpan } from "@/lib/shared/rich-text";
import type { Run } from "@/lib/resume/engine/types";
import type { FontFamilyKey, FontStyleKey } from "./font-families";
import { breakLines } from "./linebreak";
import { textWidth } from "./fonts";

/** One wrapped line: styled word units (a unit may hold several pieces glued by hyphens). */
export type WrappedLine = { units: Run[][]; last: boolean };

export function spanStyle(s: RichSpan): FontStyleKey {
  return s.bold && s.italic ? "boldItalic" : s.bold ? "bold" : s.italic ? "italic" : "regular";
}

/** Wraps plain text (browser-like kerning) or rich markup (per-word styles) into lines. */
export function wrapText(
  text: string,
  width: number,
  size: number,
  style: FontStyleKey = "regular",
  family?: FontFamilyKey,
): WrappedLine[] {
  const norm = normalizeTypography(text).replace(/\s+/g, " ").trim();
  if (!norm) return [];
  if (!hasRichMarkup(norm)) {
    return breakLines(norm, width, size, style, family).map((line) => ({
      units: line.units.map((u) => [{ text: u, style }]),
      last: line.last,
    }));
  }
  return wrapRich(parseRichText(norm), width, size, style, family);
}

export function lineCount(text: string, width: number, size: number, style: FontStyleKey = "regular", family?: FontFamilyKey): number {
  return wrapText(text, width, size, style, family).length;
}

export function wrapAtomicUnits(
  units: string[],
  width: number,
  size: number,
  style: FontStyleKey = "regular",
  family?: FontFamilyKey,
  sep = " ",
): WrappedLine[] {
  const lines: string[][] = [];
  let line: string[] = [];
  for (const u of units) {
    if (line.length && textWidth([...line, u].join(sep), size, style, family) > width + 0.01) {
      lines.push(line);
      line = [u];
    } else line.push(u);
  }
  if (line.length) lines.push(line);
  return lines.map((l, i) => ({ units: l.map((t) => [{ text: t, style }]), last: i === lines.length - 1 }));
}

function wrapRich(spans: RichSpan[], width: number, size: number, base: FontStyleKey, family?: FontFamilyKey): WrappedLine[] {
  // Pieces: break opportunities are spaces and positions after a hyphen (glue = no space before).
  const pieces: { runs: Run[]; glue: boolean }[] = [];
  let cur: Run[] = [];
  let glue = false;
  const add = (ch: string, st: FontStyleKey) => {
    const last = cur[cur.length - 1];
    if (last && last.style === st) last.text += ch;
    else cur.push({ text: ch, style: st });
  };
  const flush = (nextGlue: boolean) => {
    if (cur.length) pieces.push({ runs: cur, glue });
    cur = [];
    glue = nextGlue;
  };
  for (const sp of spans) {
    const st = sp.bold || sp.italic ? spanStyle(sp) : base;
    for (const ch of sp.text) {
      if (ch === " ") flush(false);
      else {
        add(ch, st);
        if (ch === "-") flush(true);
      }
    }
  }
  flush(false);

  const lineWidth = (us: Run[][]): number => {
    let w = 0;
    us.forEach((u, i) => {
      for (const r of u) w += textWidth(r.text, size, r.style, family);
      if (i < us.length - 1) w += textWidth(" ", size, u[u.length - 1]?.style ?? base, family);
    });
    return w;
  };
  const lines: Run[][][] = [];
  let units: Run[][] = [];
  for (const p of pieces) {
    if (!units.length) {
      units = [p.runs];
      continue;
    }
    const candidate = p.glue ? [...units.slice(0, -1), [...units[units.length - 1]!, ...p.runs]] : [...units, p.runs];
    if (lineWidth(candidate) <= width + 0.01) units = candidate;
    else {
      lines.push(units);
      units = [p.runs];
    }
  }
  if (units.length) lines.push(units);
  return lines.map((u, i) => ({ units: u, last: i === lines.length - 1 }));
}

