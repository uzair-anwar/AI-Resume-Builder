const SMALL_WORDS = new Set(["a", "an", "the", "and", "or", "for", "in", "on", "at", "to", "of", "with", "by"]);

/** Role titles use spaces, not hyphens: Forward Deployed Engineer, Full Stack Developer. */
const ROLE_HYPHEN = /\b([A-Za-z]{2,})-([A-Za-z]{2,})\b/g;

const ACRONYM_TOKENS = new Set([
  "sql",
  "api",
  "apis",
  "aws",
  "gcp",
  "azure",
  "ml",
  "ai",
  "ci",
  "cd",
  "css",
  "html",
  "http",
  "https",
  "rpc",
  "orm",
  "nosql",
  "sdk",
  "cli",
  "ide",
  "sso",
  "oauth",
  "jwt",
  "etl",
  "bi",
  "k8s",
]);

function titleCaseSegment(seg: string): string {
  if (!seg) return seg;
  const lower = seg.toLowerCase();
  if (ACRONYM_TOKENS.has(lower)) return lower.toUpperCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function titleCaseToken(token: string): string {
  return token.split("-").map(titleCaseSegment).join(" ");
}

/** Job titles and experience role lines — no hyphenated compounds (Forward Deployed, not Forward-Deployed). */
export function normalizeRoleTitleHyphens(title: string): string {
  return title.replace(ROLE_HYPHEN, (_, a: string, b: string) => {
    const bl = b.toLowerCase();
    if (bl === "js" || bl === "net") return `${a}-${b}`;
    return `${a} ${b}`;
  });
}

/** Resume headline: Forward Deployed Engineer (Python · SQL) */
export function toResumeHeadlineCase(headline: string): string {
  const trimmed = normalizeRoleTitleHyphens(headline.trim());
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
