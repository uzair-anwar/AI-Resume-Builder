import { COLUMN_WIDTH, SIZE_BODY } from "./constants";

/** Approximate PT Serif metrics at 9pt for column wrap (conservative). */
const CHAR_WIDTH_RATIO = 0.52;

export function charsPerLine(widthPt: number, fontSize: number): number {
  return Math.max(12, Math.floor(widthPt / (fontSize * CHAR_WIDTH_RATIO)));
}

export function countWrappedLines(
  text: string,
  widthPt: number,
  fontSize: number = SIZE_BODY,
): number {
  const maxChars = charsPerLine(widthPt, fontSize);
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return 0;

  const words = normalized.split(" ");
  let lines = 1;
  let current = 0;

  for (const word of words) {
    const add = word.length + (current > 0 ? 1 : 0);
    if (current > 0 && current + add > maxChars) {
      lines += 1;
      current = word.length;
    } else {
      current += add;
    }
  }
  return lines;
}

export function countBulletLines(text: string): number {
  return countWrappedLines(`• ${text}`, COLUMN_WIDTH - 8, SIZE_BODY);
}
