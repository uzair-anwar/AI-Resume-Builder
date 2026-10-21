import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import { loadTaxonomy, findTermInText, getTransferableTerm } from "./taxonomy";

export function buildProfileVocabulary(resume: MasterResume): Set<string> {
  const set = new Set<string>();
  for (const s of resume.skills) {
    set.add(s.name.toLowerCase());
    for (const a of s.aliases ?? []) set.add(a.toLowerCase());
  }
  for (const exp of resume.experience) {
    for (const f of exp.facts) {
      const words = f.text
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 2);
      words.forEach((w) => set.add(w));
    }
  }
  return set;
}

export function isTermMatched(term: string, resume: MasterResume): boolean {
  const hay = term.toLowerCase();
  for (const s of resume.skills) {
    if (s.name.toLowerCase() === hay || s.name.toLowerCase().includes(hay)) return true;
    if (s.aliases?.some((a) => a.toLowerCase() === hay)) return true;
  }
  if (resume.skillCategories.some((c) => c.label.toLowerCase().includes(hay))) return true;
  const tax = loadTaxonomy();
  const taxTerm = tax.terms.find(
    (t) => t.canonical.toLowerCase() === hay || t.aliases.some((a) => a.toLowerCase() === hay),
  );
  if (taxTerm) {
    for (const f of resume.experience.flatMap((e) => e.facts)) {
      if (findTermInText(f.text, taxTerm)) return true;
    }
  }
  return false;
}

export function relatedVia(term: string, resume: MasterResume): string | undefined {
  const tax = loadTaxonomy();
  const taxTerm = tax.terms.find((t) => t.canonical.toLowerCase() === term.toLowerCase());
  if (!taxTerm) return undefined;
  const verifiedIds = new Set<string>();
  for (const s of resume.skills) {
    for (const t of tax.terms) {
      if (findTermInText(s.name, t)) verifiedIds.add(t.id);
    }
  }
  const via = getTransferableTerm(taxTerm.id, verifiedIds);
  return via;
}
