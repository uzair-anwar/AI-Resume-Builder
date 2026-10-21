import { readFileSync } from "fs";
import path from "path";
import type { MasterResume } from "@/lib/schemas/resume";

export type TaxonomyTerm = {
  id: string;
  canonical: string;
  aliases: string[];
  family: string;
  kind?: "tool" | "concept" | "soft";
};

type TaxonomyFile = {
  terms: TaxonomyTerm[];
  transferableGroups: { id: string; terms: string[] }[];
};

let cached: TaxonomyFile | null = null;

export function loadTaxonomy(): TaxonomyFile {
  if (cached) return cached;
  const file = path.join(process.cwd(), "data", "tech-taxonomy.json");
  cached = JSON.parse(readFileSync(file, "utf8")) as TaxonomyFile;
  return cached;
}

export function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function findTermInText(text: string, term: TaxonomyTerm): boolean {
  const hay = normalizeText(text);
  const needles = [term.canonical, ...term.aliases].map(normalizeText);
  return needles.some((n) => {
    if (n.length < 2) return false;
    const re = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(n)}(?![A-Za-z0-9])`, "i");
    return re.test(hay);
  });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findTaxonomyTermByName(termOrAlias: string): TaxonomyTerm | undefined {
  const hay = normalizeText(termOrAlias);
  const tax = loadTaxonomy();
  return tax.terms.find(
    (t) =>
      normalizeText(t.canonical) === hay ||
      t.aliases.some((a) => normalizeText(a) === hay),
  );
}

export function collectResumeCorpus(resume: MasterResume): string {
  const parts: string[] = [
    resume.person.defaultHeadline,
    ...resume.skills.flatMap((s) => [s.name, ...(s.aliases ?? [])]),
    ...resume.skillCategories.map((c) => c.label),
    ...resume.summaryFacts.flatMap((f) => [f.text, ...(f.skills ?? [])]),
    ...resume.experience.flatMap((e) => [
      e.title,
      e.company,
      ...e.facts.flatMap((f) => [f.text, ...(f.skills ?? [])]),
    ]),
    ...resume.projects.flatMap((p) => [
      p.name,
      ...p.facts.flatMap((f) => [f.text, ...(f.skills ?? [])]),
    ]),
  ];
  return parts.join(" \n ");
}

export function buildVerifiedVocabulary(resume: MasterResume): Map<string, string> {
  const map = new Map<string, string>();
  for (const skill of resume.skills) {
    map.set(normalizeText(skill.name), skill.name);
    for (const a of skill.aliases ?? []) {
      map.set(normalizeText(a), skill.name);
    }
  }
  const corpus = collectResumeCorpus(resume);
  const tax = loadTaxonomy();
  for (const term of tax.terms) {
    if (findTermInText(corpus, term)) {
      map.set(normalizeText(term.canonical), term.canonical);
      for (const a of term.aliases) {
        map.set(normalizeText(a), term.canonical);
      }
    }
  }
  return map;
}

export function getTransferableTerm(
  requiredTermId: string,
  verifiedTermIds: Set<string>,
): string | undefined {
  const tax = loadTaxonomy();
  const groups = tax.transferableGroups.filter((g) => g.terms.includes(requiredTermId));
  for (const group of groups) {
    for (const t of group.terms) {
      if (verifiedTermIds.has(t) && t !== requiredTermId) {
        const term = tax.terms.find((x) => x.id === t);
        if (term) return term.canonical;
      }
    }
  }
  return undefined;
}

export function getVerifiedTaxonomyIds(resume: MasterResume): Set<string> {
  const verifiedIds = new Set<string>();
  const corpus = collectResumeCorpus(resume);
  const tax = loadTaxonomy();
  for (const t of tax.terms) {
    if (findTermInText(corpus, t)) verifiedIds.add(t.id);
  }
  return verifiedIds;
}

export function matchResumeToTerm(
  resume: MasterResume,
  term: TaxonomyTerm,
): { status: "matched" | "transferable" | "missing"; via?: string; factIds: string[] } {
  const factIds: string[] = [];
  const skillHit = resume.skills.some((s) => {
    const names = [s.name, ...(s.aliases ?? [])];
    return names.some(
      (n) =>
        normalizeText(n) === normalizeText(term.canonical) ||
        term.aliases.some((a) => normalizeText(a) === normalizeText(n)),
    );
  });

  const allFacts = [
    ...resume.summaryFacts,
    ...resume.experience.flatMap((e) => e.facts),
    ...resume.projects.flatMap((p) => p.facts),
  ];

  for (const f of allFacts) {
    if (findTermInText(f.text, term) || (f.skills ?? []).some((sk) => findTermInText(sk, term))) {
      factIds.push(f.id);
    }
  }
  if (skillHit || factIds.length) return { status: "matched", factIds };

  const verifiedIds = getVerifiedTaxonomyIds(resume);
  const via = getTransferableTerm(term.id, verifiedIds);
  if (via) return { status: "transferable", via, factIds: [] };

  return { status: "missing", factIds: [] };
}
