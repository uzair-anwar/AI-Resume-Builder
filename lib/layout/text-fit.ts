import { COLUMN_WIDTH, SIZE_BODY, BULLET_INDENT } from "./constants";
import { countBulletLines, countWrappedLines } from "./measure";
import { breakLines } from "./linebreak";

function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [text];
  return parts.map((s) => s.trim()).filter(Boolean);
}

function bulletWidth(): number {
  return COLUMN_WIDTH - BULLET_INDENT;
}

function wrappedLineCount(text: string, widthPt: number, fontSize: number): number {
  return countWrappedLines(text, widthPt, fontSize);
}

function lastLineWordCount(text: string, widthPt: number): number {
  const lines = breakLines(text, widthPt, SIZE_BODY, "regular");
  if (!lines.length) return 0;
  return lines[lines.length - 1]!.text.trim().split(/\s+/).filter(Boolean).length;
}

/** Prefer dropping whole sentences over chopping the final sentence mid-clause. */
function fitByCompleteSentences(
  text: string,
  maxLines: number,
  widthPt: number,
  fontSize: number = SIZE_BODY,
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

function fitByWordTrim(
  text: string,
  maxLines: number,
  widthPt: number,
  fontSize: number = SIZE_BODY,
): string {
  let t = text.trim();
  if (!t || wrappedLineCount(t, widthPt, fontSize) <= maxLines) return t;
  const words = t.split(/\s+/);
  while (words.length > 1 && wrappedLineCount(words.join(" "), widthPt, fontSize) > maxLines) {
    words.pop();
  }
  let out = words.join(" ").trim();
  if (out && !/[.!?]$/.test(out) && text.includes(".")) {
    const idx = text.indexOf(out);
    const rest = text.slice(idx + out.length);
    const nextEnd = rest.search(/[.!?]/);
    if (nextEnd >= 0 && nextEnd < 40) {
      const completed = `${out}${rest.slice(0, nextEnd + 1)}`.trim();
      if (wrappedLineCount(completed, widthPt, fontSize) <= maxLines + 1) out = completed;
    }
  }
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
  widthPt: number = COLUMN_WIDTH,
  fontSize: number = SIZE_BODY,
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

  t = fitByCompleteSentences(t, maxLines, width, SIZE_BODY);
  if (count() <= maxLines) {
    return relaxOrphanWidow(t, maxLines, width, count);
  }

  if (count() === maxLines + 1 && lastLineWordCount(t, width) <= 2) {
    return t;
  }

  t = fitByWordTrim(t, maxLines, width, SIZE_BODY);
  return relaxOrphanWidow(t, maxLines, width, count);
}
