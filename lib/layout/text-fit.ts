import { COLUMN_WIDTH, SIZE_BODY } from "./constants";
import { countBulletLines, countWrappedLines } from "./measure";

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
