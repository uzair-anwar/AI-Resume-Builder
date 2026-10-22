import "server-only";
import { extractDynamicJdTerms } from "./jd-dynamic-vocab";
import { extractCuratedJdTerms } from "./jd-curated-phrases";
import { filterExtractedJdTerms } from "./jd-term-quality";
import {
  inferRoleTitleFromJdContent,
  isPlausibleJobTitle,
  sanitizeDetectedJobTitle,
} from "./job-title-detect";
import { findTaxonomyTermByName, listAllTaxonomyTerms, matchedSurfaces } from "./taxonomy";

export {
  classifyJdTermKind,
  detectHiringCompanyNames,
  extractDynamicJdTerms,
  isHiringCompanyTerm,
} from "./jd-dynamic-vocab";

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
    "senior junior mid lead principal staff intern internship candidate candidates person people customers customer clients client business " +
    "matters offer culture about computer science backend frontend fullstack full-stack software systems system service services product products " +
    "environment fast-paced mission-critical real-time complex strict regulatory compliance financial money scale volume uptime " +
    "usa u.s us uk eu canadaremote equal opportunity employer diversity inclusion equity location compensation bonus equity"
  ).split(/\s+/),
);

const NON_TECH_ACRONYMS = new Set([
  "US",
  "U.S",
  "USA",
  "UK",
  "EU",
  "CEO",
  "CTO",
  "CFO",
  "COO",
  "VP",
  "HR",
  "PTO",
  "EOE",
  "EEO",
  "B2B",
  "B2C",
  "KPI",
  "OKR",
  "ROI",
  "FAQ",
  "TBD",
  "PDF",
  "FAQ",
  "LLC",
  "INC",
]);

export type ExtractedJdTerm = {
  term: string;
  /** Phrases as written in the job description. ATS tools match these, not the canonical name. */
  surfaceForms: string[];
  weight: number;
  section: "required" | "preferred" | "general";
};

function isTechShape(token: string): boolean {
  if (token.length < 2 || token.length > 40) return false;
  if (!/[A-Za-z]/.test(token)) return false;
  const upper = token.toUpperCase().replace(/\./g, "");
  if (NON_TECH_ACRONYMS.has(token.toUpperCase()) || NON_TECH_ACRONYMS.has(upper)) return false;

  // Match known taxonomy term or alias directly
  if (findTaxonomyTermByName(token)) return true;

  // Punctuated tech tokens: Node.js, C#, C++, CI/CD, .NET
  if (/[.+#/]/.test(token)) {
    if (/^\d/.test(token)) return false;
    return /^[A-Za-z.]/.test(token) && !/\.$/.test(token);
  }
  // All-caps technical acronyms: SQL, AWS, GCP, CQRS, JWT, RBAC, GRPC
  if (/^[A-Z]{2,6}[0-9]*$/.test(token)) return true;
  // CamelCase / PascalCase product or framework names: GraphQL, FastAPI, PostgreSQL, MongoDB, RabbitMQ
  if (/[a-z][A-Z]/.test(token) || /^[A-Z]{2,}[a-z]+/.test(token)) return true;
  // Alphanumeric tech tokens: EC2, S3, OAuth2, Web3, Vue3
  if (/[A-Za-z]+\d+|\d+[A-Za-z]+/.test(token) && !/^\d+(st|nd|rd|th|k|m|b|yr|yrs)$/i.test(token)) {
    return true;
  }
  return false;
}

export function extractJdTerms(jobText: string): ExtractedJdTerm[] {
  const map = new Map<string, ExtractedJdTerm>();
  const sections = splitSections(jobText);
  const taxTerms = listAllTaxonomyTerms();

  // 1. Extract known taxonomy + per-JD dynamic terms per section (highest precision)
  for (const { text, section } of sections) {
    const weightBase = section === "required" ? 4 : section === "preferred" ? 2 : 1;
    for (const t of taxTerms) {
      const surfaces = matchedSurfaces(text, t);
      if (surfaces.length) addTerm(map, t.canonical, weightBase + 1, section, surfaces);
    }
    for (const term of tokenizeTech(text)) addTerm(map, term, weightBase, section);
    for (const phrase of extractPhrases(text)) addTerm(map, phrase, weightBase + 1, section);
  }

  // 2. Curated high-value phrases (taxonomy + known ATS patterns)
  for (const cur of extractCuratedJdTerms(jobText)) {
    addTerm(map, cur.term, cur.weight, cur.section, cur.surfaceForms);
  }

  // 3. Direct JD vocabulary (lists, bullets) — filtered for quality
  for (const dyn of extractDynamicJdTerms(jobText)) {
    addTerm(map, dyn.term, dyn.weight, dyn.section, dyn.surfaceForms);
  }

  dropEmbeddedSurfaces(map);

  const canonical = new Set(taxTerms.map((t) => t.canonical.toLowerCase()));
  const raw = dropFragmentTerms(
    [...map.values()].filter(
      (t) =>
        t.term.length >= 2 &&
        !STOPWORDS.has(t.term.toLowerCase()) &&
        !NON_TECH_ACRONYMS.has(t.term.toUpperCase()),
    ),
    canonical,
  ).sort((a, b) => b.weight - a.weight);

  return filterExtractedJdTerms(raw, 40);
}

/**
 * Missing terms the model must not falsely claim.
 * Only enforce hard blocks on concrete tools/platforms/languages — never block architectural concepts,
 * soft skills, or general engineering nouns.
 */
export function isEnforceableMissingTerm(term: string): boolean {
  const t = term.trim();
  if (t.length < 2) return false;
  const lower = t.toLowerCase();
  if (STOPWORDS.has(lower)) return false;

  const taxTerm = findTaxonomyTermByName(t);
  if (taxTerm) {
    return (taxTerm.kind ?? "tool") === "tool";
  }

  // Only block non-taxonomy tokens if they clearly look like a specific tool/acronym (e.g., CQRS, WebRTC)
  return isTechShape(t) && !t.includes(" ");
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
    if (isTechShape(t)) tokens.push(t);
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
      if (p.length < 2 || p.length >= 48 || words.length > 5) continue;
      if (STOPWORDS.has(p.toLowerCase())) continue;
      if (words.some((w) => isTechShape(w))) phrases.push(p);
    }
  }
  return phrases;
}

/** "Cloud Platform" inside "Google Cloud Platform" is the longer tool, not a separate phrase. */
function dropEmbeddedSurfaces(map: Map<string, ExtractedJdTerm>) {
  const all = [...map.values()];
  const contains = (text: string, phrase: string) => {
    const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![A-Za-z0-9])${esc}(?![A-Za-z0-9])`, "i").test(text);
  };
  for (const t of all) {
    t.surfaceForms = t.surfaceForms.filter(
      (s) =>
        !all.some(
          (other) =>
            other !== t &&
            other.surfaceForms.some((o) => o.length > s.length && contains(o, s)),
        ),
    );
  }
  for (const [key, t] of map) {
    if (!t.surfaceForms.length) map.delete(key);
  }
}

function addTerm(
  map: Map<string, ExtractedJdTerm>,
  term: string,
  weight: number,
  section: "required" | "preferred" | "general",
  surfaces?: string[],
) {
  const taxTerm = findTaxonomyTermByName(term);
  const canonicalTerm = taxTerm ? taxTerm.canonical : term.trim();
  const key = canonicalTerm.toLowerCase();
  const incoming = (surfaces?.length ? surfaces : [canonicalTerm]).filter(Boolean);
  const existing = map.get(key);
  if (existing) {
    existing.weight += weight;
    for (const s of incoming) {
      if (existing.surfaceForms.some((f) => f.toLowerCase() === s.toLowerCase())) continue;
      existing.surfaceForms.push(s);
    }
    existing.surfaceForms.sort((a, b) => b.length - a.length);
    existing.surfaceForms = existing.surfaceForms.slice(0, 3);
  } else {
    map.set(key, { term: canonicalTerm, surfaceForms: incoming.slice(0, 3), weight, section });
  }
}

export function detectJobTitle(jobText: string, defaultHeadline?: string): string | undefined {
  const labeled =
    /(?:position\s*title|job\s*title|role\s*title)\s*:\s*(.+)/i.exec(jobText)?.[1]?.trim() ??
    /(?:hiring|opening)[:\s]+(.+)/i.exec(jobText)?.[1]?.trim() ??
    /looking for (?:a|an)\s+([A-Z][A-Za-z0-9\s/-]{3,55}?)\s+to\s+(?:build|join|lead|help|design|develop|work)/i.exec(
      jobText,
    )?.[1]?.trim();
  if (labeled) {
    const clean = sanitizeDetectedJobTitle(labeled.split("\n")[0]);
    if (clean) return clean;
  }

  const patterns = [
    /\b((?:senior|staff|principal|lead|forward[- ]deployed)\s+[\w\s/-]*?(?:engineer|developer|architect|scientist))\b/gi,
    /\b((?:full[- ]stack|fullstack|backend|frontend|ai)\s+[\w\s/-]*?(?:engineer|developer))\b/gi,
  ];
  for (const re of patterns) {
    const m = re.exec(jobText);
    if (m?.[1]) {
      const clean = sanitizeDetectedJobTitle(m[1]);
      if (clean) return clean;
    }
  }

  const inferred = inferRoleTitleFromJdContent(jobText, defaultHeadline);
  if (inferred) return inferred;

  const lines = jobText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 4 && l.length < 90 && !/^https?:/i.test(l));

  const roleLine = lines.find((l) => isPlausibleJobTitle(l));
  if (roleLine) return sanitizeDetectedJobTitle(roleLine);

  return undefined;
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
    if (!isEnforceableMissingTerm(t.term)) continue;
    missing.push(t.term);
  }
  return missing.slice(0, 25);
}
