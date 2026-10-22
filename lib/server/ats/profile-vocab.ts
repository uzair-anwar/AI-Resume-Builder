import type { MasterResume } from "@/lib/schemas/resume";
import {
  collectResumeCorpus,
  findTaxonomyTermByName,
  findTermInText,
  getTransferableTerm,
  getVerifiedTaxonomyIds,
} from "./taxonomy";

export function buildProfileVocabulary(resume: MasterResume): Set<string> {
  const set = new Set<string>();
  for (const s of resume.skills) {
    set.add(s.name.toLowerCase());
    for (const a of s.aliases ?? []) set.add(a.toLowerCase());
  }
  for (const c of resume.skillCategories) {
    set.add(c.label.toLowerCase());
  }
  const allTexts = [
    resume.person.defaultHeadline,
    ...resume.summaryFacts.flatMap((f) => [f.text, ...(f.skills ?? [])]),
    ...resume.experience.flatMap((e) => [
      e.title,
      ...e.facts.flatMap((f) => [f.text, ...(f.skills ?? [])]),
    ]),
    ...resume.projects.flatMap((p) => [
      p.name,
      ...p.facts.flatMap((f) => [f.text, ...(f.skills ?? [])]),
    ]),
  ];
  for (const text of allTexts) {
    const words = text
      .toLowerCase()
      .split(/[^a-z0-9.+#/-]+/)
      .filter((w) => w.length >= 2);
    for (const w of words) set.add(w);
  }
  return set;
}

function hasWord(haystack: string, needle: string): boolean {
  if (needle.length < 2) return false;
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9])${esc}(?![a-z0-9])`, "i").test(haystack);
}

/** Whole-word match in either direction, so "Go" never matches "MongoDB" and "Git" never matches "GitHub". */
function namesOverlap(a: string, b: string): boolean {
  return a === b || hasWord(a, b) || hasWord(b, a);
}

export function isTermMatched(term: string, resume: MasterResume): boolean {
  const hay = term.toLowerCase().trim();
  for (const s of resume.skills) {
    const sLow = s.name.toLowerCase();
    if (namesOverlap(sLow, hay)) return true;
    if (s.aliases?.some((a) => namesOverlap(a.toLowerCase(), hay))) {
      return true;
    }
  }
  if (resume.skillCategories.some((c) => c.label.toLowerCase().includes(hay))) return true;

  const corpus = collectResumeCorpus(resume);
  const taxTerm = findTaxonomyTermByName(term);
  if (taxTerm && findTermInText(corpus, taxTerm)) {
    return true;
  }

  const escaped = hay.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (hay.length >= 3 && new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "i").test(corpus)) {
    return true;
  }

  return false;
}

export function relatedVia(term: string, resume: MasterResume): string | undefined {
  const taxTerm = findTaxonomyTermByName(term);
  const verifiedIds = getVerifiedTaxonomyIds(resume);
  if (taxTerm) {
    const via = getTransferableTerm(taxTerm.id, verifiedIds);
    if (via) return via;
    // Concept/soft terms supported by general engineering facts
    if (taxTerm.kind === "concept" || taxTerm.kind === "soft") {
      if (taxTerm.family === "architecture" && resume.experience.length > 0) {
        return "Backend & API architecture";
      }
      if (taxTerm.family === "process" && resume.experience.length > 0) {
        return "Engineering delivery";
      }
      if (taxTerm.family === "quality" && resume.experience.length > 0) {
        return "Production engineering";
      }
    }
  }
  return undefined;
}
