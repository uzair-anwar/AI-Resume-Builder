/**
 * Collapse duplicate skill/tool wording in narrative text (e.g. "js, JavaScript" → "JavaScript").
 * Groups are built from tech-taxonomy canonical + alias lists.
 */

export type SynonymGroup = {
  canonical: string;
  /** Longest-first matching surfaces (canonical + aliases). */
  forms: string[];
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordBoundaryPattern(form: string): RegExp {
  const esc = escapeRegExp(form);
  return new RegExp(`(?<![A-Za-z0-9])${esc}(?![A-Za-z0-9])`, "gi");
}

function formPresent(text: string, form: string): boolean {
  return wordBoundaryPattern(form).test(text);
}

function pickKeeper(formsPresent: string[], canonical: string): string {
  const canonNorm = canonical.toLowerCase();
  const exactCanon = formsPresent.find((f) => f.toLowerCase() === canonNorm);
  if (exactCanon) return canonical;
  formsPresent.sort((a, b) => b.length - a.length);
  return formsPresent[0] ?? canonical;
}

function cleanupAfterRemoval(text: string): string {
  let out = text;
  out = out.replace(/\s+,/g, ",").replace(/,\s*,/g, ",");
  out = out.replace(/,\s+and\s+,/gi, ", and ");
  out = out.replace(/,\s+and\s+and\b/gi, ", and");
  out = out.replace(/\band\s+and\b/gi, "and");
  out = out.replace(/\b(using|with|via|in|on|for)\s+and\b/gi, "$1");
  out = out.replace(/\s{2,}/g, " ");
  return out.trim();
}

function removeForm(text: string, form: string, keeper: string): string {
  if (form.toLowerCase() === keeper.toLowerCase()) return text;
  return cleanupAfterRemoval(text.replace(wordBoundaryPattern(form), ""));
}

/** Keep one surface per taxonomy synonym group; prefer the canonical name. */
export function dedupeSynonymsInText(text: string, groups: SynonymGroup[]): string {
  if (!text.trim()) return text;
  let out = text;
  const sorted = [...groups].sort(
    (a, b) => (b.forms[0]?.length ?? 0) - (a.forms[0]?.length ?? 0),
  );
  for (const group of sorted) {
    const present = group.forms.filter((f) => formPresent(out, f));
    if (present.length <= 1) continue;
    const keeper = pickKeeper(present, group.canonical);
    for (const form of present) {
      out = removeForm(out, form, keeper);
    }
  }
  return out
    .replace(/^\s*,\s*/, "")
    .replace(/\s+([,.])/g, "$1")
    .replace(/([,.])\s*([,.])/g, "$1")
    .trim();
}

export function buildSynonymGroupsFromTerms(
  terms: { canonical: string; aliases: string[] }[],
): SynonymGroup[] {
  const groups: SynonymGroup[] = [];
  for (const term of terms) {
    const forms = [term.canonical, ...term.aliases].filter((f) => f.trim().length >= 2);
    const unique = [...new Map(forms.map((f) => [f.toLowerCase(), f])).values()];
    if (unique.length < 2) continue;
    unique.sort((a, b) => b.length - a.length);
    groups.push({ canonical: term.canonical, forms: unique });
  }
  return groups;
}
