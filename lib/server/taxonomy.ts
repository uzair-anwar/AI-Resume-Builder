import "server-only";
import { readFileSync } from "fs";
import path from "path";
import type { MasterResume } from "@/lib/schemas/resume";

export type TaxonomyTerm = {
  id: string;
  canonical: string;
  aliases: string[];
  family: string;
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
    const re = new RegExp(`\\b${escapeRegExp(n)}\\b`, "i");
    return re.test(hay);
  });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildVerifiedVocabulary(resume: MasterResume): Map<string, string> {
  const map = new Map<string, string>();
  for (const skill of resume.skills) {
    map.set(normalizeText(skill.name), skill.name);
    for (const a of skill.aliases ?? []) {
      map.set(normalizeText(a), skill.name);
    }
  }
  const tax = loadTaxonomy();
  for (const term of tax.terms) {
    if (findTermInText(resume.skills.map((s) => s.name).join(" "), term)) {
      map.set(normalizeText(term.canonical), term.canonical);
    }
  }
  for (const exp of resume.experience) {
    for (const f of exp.facts) {
      for (const t of tax.terms) {
        if (findTermInText(f.text, t)) {
          map.set(normalizeText(t.canonical), t.canonical);
        }
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
  const group = tax.transferableGroups.find((g) => g.terms.includes(requiredTermId));
  if (!group) return undefined;
  for (const t of group.terms) {
    if (verifiedTermIds.has(t) && t !== requiredTermId) {
      const term = tax.terms.find((x) => x.id === t);
      return term?.canonical;
    }
  }
  return undefined;
}

export function matchResumeToTerm(
  resume: MasterResume,
  term: TaxonomyTerm,
): { status: "matched" | "transferable" | "missing"; via?: string; factIds: string[] } {
  const factIds: string[] = [];
  const skillHit = resume.skills.some((s) => {
    const names = [s.name, ...(s.aliases ?? [])];
    return names.some((n) => normalizeText(n) === normalizeText(term.canonical));
  });
  if (skillHit) return { status: "matched", factIds };

  for (const exp of resume.experience) {
    for (const f of exp.facts) {
      if (findTermInText(f.text, term)) factIds.push(f.id);
    }
  }
  if (factIds.length) return { status: "matched", factIds };

  const verifiedIds = new Set<string>();
  for (const s of resume.skills) {
    const tax = loadTaxonomy();
    for (const t of tax.terms) {
      if (findTermInText(s.name, t)) verifiedIds.add(t.id);
    }
  }
  const via = getTransferableTerm(term.id, verifiedIds);
  if (via) return { status: "transferable", via, factIds: [] };

  return { status: "missing", factIds: [] };
}
