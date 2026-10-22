const SMALL_WORDS = new Set(["a", "an", "the", "and", "or", "for", "in", "on", "at", "to", "of", "with", "by"]);

function titleCaseSegment(seg: string): string {
  if (!seg) return seg;
  const lower = seg.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function titleCaseToken(token: string): string {
  return token.split("-").map(titleCaseSegment).join("-");
}

/** Resume headline: Forward-Deployed Engineer (Python · SQL) */
export function toResumeHeadlineCase(headline: string): string {
  const trimmed = headline.trim();
  const parenMatch = trimmed.match(/^(.+?)(\s*\([^)]*\))\s*$/);
  const core = (parenMatch?.[1] ?? trimmed).trim();
  const paren = parenMatch?.[2] ?? "";

  const titleCore = core
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && SMALL_WORDS.has(word.toLowerCase())) return word.toLowerCase();
      return titleCaseToken(word);
    })
    .join(" ");

  const titleParen = paren.replace(/\(([^)]*)\)/, (_, inner: string) => {
    const parts = inner
      .split("·")
      .map((chunk) =>
        chunk
          .trim()
          .split(/\s+/)
          .map((w) => titleCaseToken(w))
          .join(" "),
      )
      .join(" · ");
    return `(${parts})`;
  });

  return `${titleCore}${titleParen}`.trim();
}
