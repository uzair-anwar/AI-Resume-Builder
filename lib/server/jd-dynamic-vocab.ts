import "server-only";
import type { ExtractedJdTerm } from "./jd-extract";
import { findTaxonomyTermByName } from "./taxonomy";

export type JdTermKind = "tool" | "concept" | "soft" | "industry" | "noise";

const SOFT_RE =
  /\b(leadership|mentor|collaborat|communicat|team\s*building|initiative|innovat|professional|passionate|judgment|clarity|stakeholder|agile|scrum|ownership|interpersonal|problem[- ]solving|critical\s+thinking|detail[- ]oriented|self[- ]starter|proactive|maintain|monitor|write|present)\b/i;

const CONCEPT_RE =
  /\b(architecture|scalab|reliab|performan|optimiz|distributed|microservice|infrastructure|integration|automation|pipeline|security|compliance|observab|testing|design|api|data\s+(model|struct|pipeline|govern)|machine\s+learning|artificial\s+intelligence|cloud|serverless|event[- ]driven|real[- ]time|workflow)\b/i;

const INDUSTRY_RE =
  /\b(healthcare|fintech|finance|financial|banking|mortgage|insurance|retail|e[- ]?commerce|saas|edtech|logistics|supply\s+chain|manufacturing|automotive|aerospace|defense|government|telecom|media|gaming|crypto|blockchain|legal|hrtech|proptech|cleantech|energy|oil\s+and\s+gas|pharma|biotech|fraud|aml|kyc|hipaa|pci)\b/i;

const NOISE_RE =
  /\b(equal opportunity|benefits|compensation|salary|visa|sponsorship|apply\s+now|about\s+us|our\s+mission|we\s+are\s+looking|you\s+will|responsibilities\s+include|what\s+you|who\s+you\s+are)\b/i;

const LIST_LINE =
  /^(?:[-•*●▪◦]|\d+[.)])\s+(.+)$/;

const SKILL_HEADER =
  /^(?:skills?|technologies?|tech\s+stack|tools?|requirements?|qualifications?|must\s+have|nice\s+to\s+have)\s*[:—-]\s*(.+)$/i;

/** Hiring company / brand names from the JD — never copy onto the candidate resume. */
export function detectHiringCompanyNames(jobText: string): string[] {
  const names = new Set<string>();
  const patterns = [
    /\bat\s+([A-Z][A-Za-z0-9.&'-]{1,40})\b/g,
    /\bAbout\s+([A-Z][A-Za-z0-9.&'-]{1,40})\b/g,
    /\bjoin\s+([A-Z][A-Za-z0-9.&'-]{1,40})\b/gi,
    /\b([A-Z][A-Za-z0-9.&'-]{1,40})\s+is\s+(?:a|an|the|hiring|seeking|looking)\b/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(jobText))) {
      const name = m[1]!.replace(/\.$/, "").trim();
      if (name.length < 2 || name.length > 42) continue;
      if (/^(The|We|Our|You|Your|They|This|That|Remote|Hybrid)$/i.test(name)) continue;
      names.add(name);
    }
  }
  return [...names];
}

export function isHiringCompanyTerm(term: string, hiringCompanies: string[]): boolean {
  const t = term.toLowerCase().trim();
  return hiringCompanies.some((c) => {
    const cl = c.toLowerCase();
    return t === cl || t.includes(cl) || cl.includes(t);
  });
}

export function classifyJdTermKind(term: string): JdTermKind {
  const t = term.trim();
  if (t.length < 2 || t.length > 55) return "noise";
  if (NOISE_RE.test(t)) return "noise";
  const tax = findTaxonomyTermByName(t);
  if (tax?.kind === "soft") return "soft";
  if (tax?.kind === "concept") return "concept";
  if (tax) return tax.kind ?? "tool";
  if (SOFT_RE.test(t)) return "soft";
  if (INDUSTRY_RE.test(t)) return "industry";
  if (CONCEPT_RE.test(t)) return "concept";
  if (/[.+#/-]|[A-Z]{2,}|\.js\b|\.net\b/i.test(t)) return "tool";
  if (t.split(/\s+/).length <= 3 && /[a-z]/.test(t) && /[A-Z]/.test(t)) return "tool";
  if (t.split(/\s+/).length >= 2 && t.split(/\s+/).length <= 4) return "concept";
  return "concept";
}

function slugId(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function splitListChunk(chunk: string): string[] {
  return chunk
    .split(/\||;|,|\band\b|\bor\b/gi)
    .map((s) => s.trim().replace(/^[-•*]\s*/, ""))
    .filter((s) => s.length >= 2 && s.length <= 50);
}

/**
 * Pulls skill/requirement phrases directly from the job description text.
 * Works for any industry — not limited to data/tech-taxonomy.json.
 */
export function extractDynamicJdTerms(jobText: string): ExtractedJdTerm[] {
  const map = new Map<string, ExtractedJdTerm>();
  const add = (
    raw: string,
    weight: number,
    section: ExtractedJdTerm["section"],
    surface?: string,
  ) => {
    const term = raw.trim().replace(/\s+/g, " ");
    if (term.length < 2 || term.length > 55) return;
    if (classifyJdTermKind(term) === "noise") return;
    const key = term.toLowerCase();
    const surf = surface ?? term;
    const existing = map.get(key);
    if (existing) {
      existing.weight += weight;
      if (!existing.surfaceForms.some((f) => f.toLowerCase() === surf.toLowerCase())) {
        existing.surfaceForms.push(surf);
      }
    } else {
      map.set(key, {
        term,
        surfaceForms: [surf],
        weight,
        section,
      });
    }
  };

  const lines = jobText.split(/\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const header = SKILL_HEADER.exec(trimmed);
    if (header?.[1]) {
      for (const part of splitListChunk(header[1])) add(part, 5, "required", part);
      continue;
    }

    const bullet = LIST_LINE.exec(trimmed);
    if (bullet?.[1]) {
      const body = bullet[1].trim();
      if (body.length <= 60 && body.split(/\s+/).length <= 8) {
        add(body, 3, "general", body);
      }
      for (const part of splitListChunk(body)) {
        if (part.split(/\s+/).length <= 4) add(part, 3, "general", part);
      }
      continue;
    }
  }

  // Repeated capitalized / technical 2–4 word phrases (common in ATS job posts)
  const phraseRe = /\b([A-Za-z][A-Za-z0-9.+#/&-]*(?:\s+[A-Za-z][A-Za-z0-9.+#/&-]*){1,3})\b/g;
  let pm: RegExpExecArray | null;
  while ((pm = phraseRe.exec(jobText))) {
    const phrase = pm[1]!.trim();
    const words = phrase.split(/\s+/);
    if (words.length < 2 || words.length > 4) continue;
    const kind = classifyJdTermKind(phrase);
    if (kind === "noise" || (kind === "tool" && words.length > 2 && !/[.+#/-]/.test(phrase))) continue;
    add(phrase, 2, "general", phrase);
  }

  return [...map.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 40);
}

export function dynamicTermId(term: string): string {
  return `jd-${slugId(term)}`;
}
