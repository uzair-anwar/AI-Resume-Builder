/** Inline markup for resume copy (stored in plain strings, rendered in PDF + editor preview). */

export type RichSpan = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  small?: boolean;
};

type StyleFlags = { bold: boolean; italic: boolean; small: boolean };

const DEFAULT_FLAGS: StyleFlags = { bold: false, italic: false, small: false };

function pushChar(spans: RichSpan[], ch: string, flags: StyleFlags) {
  if (!ch) return;
  const last = spans[spans.length - 1];
  if (
    last &&
    last.bold === flags.bold &&
    last.italic === flags.italic &&
    last.small === flags.small
  ) {
    last.text += ch;
    return;
  }
  spans.push({
    text: ch,
    bold: flags.bold || undefined,
    italic: flags.italic || undefined,
    small: flags.small || undefined,
  });
}

/** Parse `**bold**`, `*italic*`, and `{{small}}…{{/small}}`. */
export function parseRichText(input: string): RichSpan[] {
  const spans: RichSpan[] = [];
  let flags: StyleFlags = { ...DEFAULT_FLAGS };
  let i = 0;

  while (i < input.length) {
    if (input.startsWith("{{small}}", i)) {
      i += "{{small}}".length;
      flags = { ...flags, small: true };
      continue;
    }
    if (input.startsWith("{{/small}}", i)) {
      i += "{{/small}}".length;
      flags = { ...flags, small: false };
      continue;
    }
    if (input.startsWith("**", i)) {
      i += 2;
      flags = { ...flags, bold: !flags.bold };
      continue;
    }
    if (input[i] === "*" && input[i + 1] !== "*") {
      i += 1;
      flags = { ...flags, italic: !flags.italic };
      continue;
    }

    pushChar(spans, input[i]!, flags);
    i += 1;
  }

  return spans.filter((s) => s.text.length > 0);
}

export function plainFromRich(input: string): string {
  return parseRichText(input).map((s) => s.text).join("");
}

export function hasRichMarkup(input: string): boolean {
  if (!input) return false;
  if (/\*\*|{{small}}|{{\/small}}/.test(input)) return true;
  return /(?:^|[^*])\*[^*\s]/.test(input);
}

export function sliceRichSpans(spans: RichSpan[], start: number, end: number): RichSpan[] {
  if (start >= end) return [];
  const out: RichSpan[] = [];
  let pos = 0;
  for (const span of spans) {
    const spanStart = pos;
    const spanEnd = pos + span.text.length;
    pos = spanEnd;
    if (spanEnd <= start || spanStart >= end) continue;
    const from = Math.max(0, start - spanStart);
    const to = Math.min(span.text.length, end - spanStart);
    const piece = span.text.slice(from, to);
    if (!piece) continue;
    out.push({
      text: piece,
      bold: span.bold,
      italic: span.italic,
      small: span.small,
    });
  }
  return mergeAdjacentSpans(out);
}

function mergeAdjacentSpans(spans: RichSpan[]): RichSpan[] {
  const merged: RichSpan[] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.bold === s.bold &&
      last.italic === s.italic &&
      last.small === s.small
    ) {
      last.text += s.text;
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

export function wrapRichSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  wrap: { open: string; close: string },
): { value: string; selectionStart: number; selectionEnd: number } {
  const before = value.slice(0, selectionStart);
  const selected = value.slice(selectionStart, selectionEnd);
  const after = value.slice(selectionEnd);
  const next = `${before}${wrap.open}${selected}${wrap.close}${after}`;
  const start = selectionStart + wrap.open.length;
  const end = start + selected.length;
  return { value: next, selectionStart: start, selectionEnd: end };
}
