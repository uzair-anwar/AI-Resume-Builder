import { activeProfile, tailorCaps } from "./profile";
import { countBulletLines, countWrappedLines } from "./measure";
import { breakLines } from "./linebreak";

/** Splits on sentence ends only (a "." inside "Next.js" or "3.5" is not a sentence end). */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function bulletWidth(): number {
  return activeProfile().bulletWidth;
}

function wrappedLineCount(text: string, widthPt: number, fontSize: number): number {
  return countWrappedLines(text, widthPt, fontSize);
}

function lastLineWordCount(text: string, widthPt: number): number {
  const p = activeProfile();
  const lines = breakLines(text, widthPt, p.bodySize, "regular", p.fontFamily);
  if (!lines.length) return 0;
  return lines[lines.length - 1]!.text.trim().split(/\s+/).filter(Boolean).length;
}

/** Prefer dropping whole sentences over chopping the final sentence mid-clause. */
function fitByCompleteSentences(
  text: string,
  maxLines: number,
  widthPt: number,
  fontSize: number = activeProfile().bodySize,
): string {
  const sentences = splitSentences(text);
  if (!sentences.length) return text.trim();

  let acc = "";
  for (const sentence of sentences) {
    const next = acc ? `${acc} ${sentence}` : sentence;
    if (wrappedLineCount(next, widthPt, fontSize) <= maxLines) {
      acc = next;
    } else {
      break;
    }
  }
  if (acc) return acc;

  const first = sentences[0]!;
  if (wrappedLineCount(first, widthPt, fontSize) <= maxLines) return first;
  return fitByWordTrim(first, maxLines, widthPt, fontSize);
}

/** Removes a trailing connector/comma left by trimming ("..., including S3 and" -> "..., including S3"). */
function stripDanglingTail(text: string): string {
  let out = text.trim();
  for (let i = 0; i < 6; i++) {
    const next = out
      .replace(/[,;:\s]+$/, "")
      .replace(/\s+(?:and|or|with|including|of|to|the|a|an|in|for|on|by|as|via|using|across|from)$/i, "")
      .replace(/,\s*(?:including|ability to)$/i, "");
    if (next === out) break;
    out = next;
  }
  return out;
}

function fitByWordTrim(
  text: string,
  maxLines: number,
  widthPt: number,
  fontSize: number = activeProfile().bodySize,
): string {
  const t = text.trim();
  if (!t || wrappedLineCount(t, widthPt, fontSize) <= maxLines) return t;
  const words = t.split(/\s+/);
  while (words.length > 1 && wrappedLineCount(words.join(" "), widthPt, fontSize) > maxLines) {
    words.pop();
  }
  let out = stripDanglingTail(words.join(" ").trim());
  if (!tailorCaps().exactBullets && out && !/[.!?]$/.test(out) && text.includes(".")) {
    const idx = text.indexOf(out);
    const rest = text.slice(idx + out.length);
    const nextEnd = rest.search(/[.!?]/);
    if (nextEnd >= 0 && nextEnd < 40) {
      const completed = `${out}${rest.slice(0, nextEnd + 1)}`.trim();
      if (wrappedLineCount(completed, widthPt, fontSize) <= maxLines + 1) out = completed;
    }
  }
  if (out && /[.!?]$/.test(t) && !/[.!?]$/.test(out)) out += ".";
  return out;
}

/** If the last wrapped line is a 1–2 word widow, allow one extra line instead of trimming. */
function relaxOrphanWidow(
  text: string,
  maxLines: number,
  widthPt: number,
  lineCountFn: (t: string) => number,
): string {
  const lines = lineCountFn(text);
  if (lines <= 1) return text;
  const widow = lastLineWordCount(text, widthPt);
  if (widow >= 3) return text;
  if (lines === 2 && widow <= 2 && lines <= maxLines + 1) return text;
  return text;
}

export function fitToMaxWrappedLines(
  text: string,
  maxLines: number,
  widthPt: number = activeProfile().summaryWidth,
  fontSize: number = activeProfile().bodySize,
): string {
  let t = text.trim();
  if (!t || wrappedLineCount(t, widthPt, fontSize) <= maxLines) {
    return relaxOrphanWidow(t, maxLines, widthPt, (x) => wrappedLineCount(x, widthPt, fontSize));
  }
  t = fitByCompleteSentences(t, maxLines, widthPt, fontSize);
  if (wrappedLineCount(t, widthPt, fontSize) <= maxLines) {
    return relaxOrphanWidow(t, maxLines, widthPt, (x) => wrappedLineCount(x, widthPt, fontSize));
  }
  t = fitByWordTrim(t, maxLines, widthPt, fontSize);
  return relaxOrphanWidow(t, maxLines, widthPt, (x) => wrappedLineCount(x, widthPt, fontSize));
}

export function fitToMaxBulletLines(text: string, maxLines: number): string {
  const width = bulletWidth();
  let t = text.trim();
  const count = () => countBulletLines(t);

  if (!t || count() <= maxLines) {
    return relaxOrphanWidow(t, maxLines, width, () => countBulletLines(t));
  }

  t = fitByCompleteSentences(t, maxLines, width, activeProfile().bodySize);
  if (count() <= maxLines) {
    return relaxOrphanWidow(t, maxLines, width, count);
  }

  if (!tailorCaps().exactBullets && count() === maxLines + 1 && lastLineWordCount(t, width) <= 2) {
    return t;
  }

  t = fitByWordTrim(t, maxLines, width, activeProfile().bodySize);
  return relaxOrphanWidow(t, maxLines, width, count);
}
