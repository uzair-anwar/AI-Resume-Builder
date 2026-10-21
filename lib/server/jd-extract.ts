import "server-only";
import { loadTaxonomy, findTermInText } from "./taxonomy";

const STOPWORDS = new Set(
  (
    "a an the and or but nor so yet for with without within into onto over under about above after before between through during " +
    "of in on at to by from as is are was were be been being am do does did done have has had having will would can could should may might must shall " +
    "you your yours we our ours us they their them he she it its this that these those there here who whom whose which what when where why how " +
    "not no yes all any each every both either neither some such than then too very also just only more most much many other another same own " +
    "years year months month weeks week days day experience experiences ability able team teams work works working worked using use used uses including include includes " +
    "required require requires requirement requirements preferred prefer qualifications qualification responsibilities responsibility " +
    "strong strongly good great excellent solid proven proficient deep hands-on hands plus bonus ideal nice looking seeking join joining " +
    "engineer engineers engineering developer developers development role roles position positions title job jobs company companies " +
    "remote hybrid onsite contract contractor duration extension possible full part time permanent salary benefits apply " +
    "platform platforms skills skill knowledge understanding familiarity background degree bachelor master related field " +
    "design build operate manage support improve collaborate ensure provide create develop maintain implement deliver drive lead " +
    "new high low large small best well high-quality across per etc one two three four five six seven eight nine ten first second " +
    "senior junior mid lead principal staff intern internship candidate candidates person people customers customer clients client business"
  ).split(/\s+/),
);

export type ExtractedJdTerm = {
  term: string;
  weight: number;
  section: "required" | "preferred" | "general";
};

function isTechShape(token: string, sentenceStart: boolean): boolean {
  if (token.length < 2 || token.length > 40) return false;
  if (!/[A-Za-z]/.test(token)) return false;
  if (/[.+#/]/.test(token)) return /^[A-Za-z]/.test(token) && !/^\.|\.$/.test(token);
  if (/^[A-Z]{2,}[0-9]*$/.test(token)) return true;
  if (/[a-z][A-Z]/.test(token)) return true;
  if (/\d/.test(token)) return true;
  if (/^[A-Z][a-z]{2,}$/.test(token) && !sentenceStart) return true;
  return false;
}

export function extractJdTerms(jobText: string): ExtractedJdTerm[] {
  const map = new Map<string, ExtractedJdTerm>();
  const sections = splitSections(jobText);

  for (const { text, section } of sections) {
    const weightBase = section === "required" ? 3 : section === "preferred" ? 2 : 1;
    for (const term of tokenizeTech(text)) addTerm(map, term, weightBase, section);
    for (const phrase of extractPhrases(text)) addTerm(map, phrase, weightBase + 1, section);
  }

  // Known technologies (taxonomy) are always worth showing, even when lowercase.
  for (const t of loadTaxonomy().terms) {
    if (findTermInText(jobText, t)) addTerm(map, t.canonical, 3, "general");
  }

  const canonical = new Set(loadTaxonomy().terms.map((t) => t.canonical.toLowerCase()));
  return dropFragmentTerms(
    [...map.values()].filter((t) => t.term.length >= 2 && !STOPWORDS.has(t.term.toLowerCase())),
    canonical,
  )
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 35);
}

/** Missing terms the model must not claim. Extraction already keeps only stack/product-like terms. */
export function isEnforceableMissingTerm(term: string): boolean {
  const t = term.trim();
  if (t.length < 3) return false;
  return !STOPWORDS.has(t.toLowerCase());
}

/** Drops fragments ("Code", "Actions") that only exist as part of a longer extracted term. */
export function dropFragmentTerms<T extends { term: string }>(terms: T[], keep: Set<string>): T[] {
  const multi = terms.map((t) => t.term.toLowerCase()).filter((t) => t.includes(" "));
  return terms.filter((t) => {
    const lower = t.term.toLowerCase();
    if (lower.includes(" ") || keep.has(lower)) return true;
    const re = new RegExp(`(^|\\s)${lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`);
    return !multi.some((m) => re.test(m));
  });
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
  const re = /[A-Za-z][A-Za-z0-9.+#/-]{1,30}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const t = m[0].replace(/[.\-/]+$/, "");
    if (STOPWORDS.has(t.toLowerCase())) continue;
    const before = text.slice(0, m.index).trimEnd();
    const prev = before.slice(-1);
    const sentenceStart =
      !before || /[.!?:;•*\u2022\-–—\n]/.test(prev) || text[m.index - 1] === "\n";
    if (isTechShape(t, sentenceStart)) tokens.push(t);
  }
  return tokens;
}

const LEADING_FILLER =
  /^(?:strong|solid|good|proven|deep|hands-on|excellent|demonstrable|practical|broad|working|basic)\s+/i;

function extractPhrases(text: string): string[] {
  const phrases: string[] = [];
  const re = /experience (?:with|in|using)\s+([^.;\n]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    for (const part of m[1].split(/,| and | or /)) {
      const p = part.trim().replace(LEADING_FILLER, "");
      const words = p.split(/\s+/);
      if (p.length < 2 || p.length >= 40 || words.length > 3) continue;
      if (STOPWORDS.has(p.toLowerCase())) continue;
      if (words.some((w, i) => isTechShape(w, i === 0 && false))) phrases.push(p);
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
  const labeled =
    /(?:position\s*title|job\s*title|role)\s*:\s*(.+)/i.exec(jobText)?.[1]?.trim() ??
    /(?:hiring|opening)[:\s]+(.+)/i.exec(jobText)?.[1]?.trim();
  if (labeled && labeled.length > 3 && labeled.length < 120) return labeled.split("\n")[0];

  const line = jobText
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 4 && l.length < 100 && !/^https?:/i.test(l));
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
