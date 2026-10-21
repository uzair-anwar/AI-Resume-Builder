import "server-only";

const STOPWORDS = new Set([
  "the",
  "and",
  "or",
  "for",
  "with",
  "you",
  "your",
  "our",
  "will",
  "must",
  "have",
  "years",
  "year",
  "experience",
  "ability",
  "team",
  "work",
  "using",
  "including",
  "required",
  "preferred",
  "responsibilities",
  "requirements",
  "qualifications",
]);

export type ExtractedJdTerm = {
  term: string;
  weight: number;
  section: "required" | "preferred" | "general";
};

export function extractJdTerms(jobText: string): ExtractedJdTerm[] {
  const map = new Map<string, ExtractedJdTerm>();
  const sections = splitSections(jobText);

  for (const { text, section } of sections) {
    const weightBase = section === "required" ? 3 : section === "preferred" ? 2 : 1;
    for (const token of tokenizeTech(text)) {
      addTerm(map, token, weightBase, section);
    }
    for (const phrase of extractPhrases(text)) {
      addTerm(map, phrase, weightBase + 1, section);
    }
  }

  // CamelCase / dotted tokens from full text
  const patterns = jobText.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b|\b[\w.+#/-]{2,}\b/g) ?? [];
  for (const p of patterns) {
    if (p.length >= 2 && p.length <= 40) addTerm(map, p, 2, "general");
  }

  return [...map.values()]
    .filter((t) => t.term.length >= 2 && !STOPWORDS.has(t.term.toLowerCase()))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 35);
}

function splitSections(
  text: string,
): { text: string; section: "required" | "preferred" | "general" }[] {
  const out: { text: string; section: "required" | "preferred" | "general" }[] = [];
  const req =
    /(requirements|qualifications|must have|what you.?ll need)[:\s]*([\s\S]*?)(?=nice to have|preferred|responsibilities|benefits|$)/i.exec(
      text,
    );
  const pref =
    /(nice to have|preferred|bonus)[:\s]*([\s\S]*?)(?=requirements|responsibilities|benefits|$)/i.exec(
      text,
    );
  if (req?.[2]) out.push({ text: req[2], section: "required" });
  if (pref?.[2]) out.push({ text: pref[2], section: "preferred" });
  out.push({ text, section: "general" });
  return out;
}

function tokenizeTech(text: string): string[] {
  const tokens: string[] = [];
  const re = /\b([A-Za-z][A-Za-z0-9.+#/-]{1,30})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const t = m[1];
    if (t.length >= 2) tokens.push(t);
  }
  return tokens;
}

function extractPhrases(text: string): string[] {
  const phrases: string[] = [];
  const re = /experience (?:with|in|using)\s+([^.;\n]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    for (const part of m[1].split(/,| and /)) {
      const p = part.trim();
      if (p.length >= 2 && p.length < 50) phrases.push(p);
    }
  }
  return phrases;
}

function addTerm(
  map: Map<string, ExtractedJdTerm>,
  term: string,
  weight: number,
  section: "required" | "preferred" | "general",
) {
  const key = term.toLowerCase();
  const existing = map.get(key);
  if (existing) {
    existing.weight += weight;
  } else {
    map.set(key, { term: term.trim(), weight, section });
  }
}

export function detectJobTitle(jobText: string): string | undefined {
  const line = jobText
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 4 && l.length < 100);
  return line;
}

export function missingJdTermsForOutput(
  terms: ExtractedJdTerm[],
  profileVocabulary: Set<string>,
  relatedMatchers: (term: string) => boolean,
): string[] {
  const missing: string[] = [];
  for (const t of terms) {
    const key = t.term.toLowerCase();
    if (profileVocabulary.has(key)) continue;
    if (relatedMatchers(t.term)) continue;
    if ([...profileVocabulary].some((v) => key.includes(v) || v.includes(key))) continue;
    missing.push(t.term);
  }
  return missing.slice(0, 25);
}
