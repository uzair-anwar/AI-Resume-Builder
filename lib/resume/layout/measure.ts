import { activeProfile } from "./profile";
import { countLines } from "./linebreak";

/** Exact wrapped line count (active template's font metrics), same algorithm the PDF uses. */
export function countWrappedLines(text: string, widthPt: number, fontSize?: number): number {
  const p = activeProfile();
  return countLines(text, widthPt, fontSize ?? p.bodySize, "regular", p.fontFamily);
}

export function countBulletLines(text: string): number {
  const p = activeProfile();
  return countLines(text, p.bulletWidth, p.bodySize, "regular", p.fontFamily);
}

export function countProjectBulletLines(text: string): number {
  const p = activeProfile();
  return countLines(text, p.projectBulletWidth, p.bodySize, "regular", p.fontFamily);
}
