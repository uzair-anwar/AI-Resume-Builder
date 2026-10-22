import { COLUMN_WIDTH, SIZE_BODY, BULLET_INDENT } from "./constants";
import { countLines } from "./linebreak";

/** Exact (PT Serif metrics) wrapped line count, same algorithm the PDF uses. */
export function countWrappedLines(
  text: string,
  widthPt: number,
  fontSize: number = SIZE_BODY,
): number {
  return countLines(text, widthPt, fontSize, "regular");
}

export function countBulletLines(text: string): number {
  return countLines(text, COLUMN_WIDTH - BULLET_INDENT, SIZE_BODY, "regular");
}
