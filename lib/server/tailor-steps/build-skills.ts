import type { MasterResume } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { countSkillLines } from "@/lib/layout/budgets";
import { relatedVia } from "../profile-vocab";
import type { RoleFamily } from "../role-families";
import { buildSkillResolver } from "@/lib/skills/skill-resolver";
import { hasForeignTerm } from "../step-validation-helpers";

function wordIn(haystack: string, needle: string): boolean {
  if (needle.length < 2) return false;
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9])${esc}(?![a-z0-9])`, "i").test(haystack);
}

function skillIdForTerm(term: string, resume: MasterResume): string[] {
  const ids: string[] = [];
  const hay = term.toLowerCase();
  for (const s of resume.skills) {
    const name = s.name.toLowerCase();
    if (
      name === hay ||
      wordIn(name, hay) ||
      wordIn(hay, name) ||
      s.aliases?.some((a) => a.toLowerCase() === hay)
    ) {
      ids.push(s.id);
    }
  }
  return ids;
}

function factLinkedSkillIds(resume: MasterResume): string[] {
  const byName = new Map(resume.skills.map((s) => [s.name.toLowerCase(), s.id]));
  const ids: string[] = [];
  const allFacts = [
    ...resume.experience.flatMap((e) => e.facts),
    ...resume.projects.flatMap((p) => p.facts),
  ];
  for (const f of allFacts) {
    for (const sk of f.skills ?? []) {
      const id = byName.get(sk.toLowerCase());
      if (id && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

function mentionsSkill(text: string, names: string[]): boolean {
  const hay = text.toLowerCase();
  return names.some((n) => {
    const k = n.toLowerCase();
    if (k.length < 2) return false;
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![a-z0-9])${esc}(?![a-z0-9])`, "i").test(hay);
  });
}

/**
 * How strongly the profile evidences each skill: counts the facts (recent roles weigh more) that
 * cite the skill in `fact.skills` or mention it in their text. Used to rank skills inside a category
 * and to decide what to drop last when the skills block has to fit its line budget.
 */
export function skillEvidenceWeights(resume: MasterResume): Map<string, number> {
  const weights = new Map<string, number>();
  const bump = (id: string, w: number) => weights.set(id, (weights.get(id) ?? 0) + w);

  const scan = (facts: MasterResume["summaryFacts"], w: number) => {
    for (const f of facts) {
      for (const s of resume.skills) {
        const names = [s.name, ...(s.aliases ?? [])];
        const cited = (f.skills ?? []).some((x) =>
          names.some((n) => n.toLowerCase() === x.toLowerCase()),
        );
        if (cited || mentionsSkill(f.text, names)) bump(s.id, w);
      }
    }
  };

  scan(resume.summaryFacts, 0.5);
  resume.experience.forEach((e, i) => scan(e.facts, i === 0 ? 1.5 : i === 1 ? 1.2 : 1));
  for (const p of resume.projects) scan(p.facts, 0.5);
  return weights;
}

/** Strongest evidenced skills across the profile (e.g. Node.js, React.js, AWS), used to anchor the summary. */
export function primaryStackNames(resume: MasterResume, limit = 4): string[] {
  const weights = skillEvidenceWeights(resume);
  const eligible = new Set(["cat-languages", "cat-frameworks", "cat-cloud", "cat-databases"]);
  return resume.skills
    .filter((s) => eligible.has(s.categoryId) && (weights.get(s.id) ?? 0) > 0)
    .sort((a, b) => (weights.get(b.id) ?? 0) - (weights.get(a.id) ?? 0))
    .slice(0, limit)
    .map((s) => s.name);
}

/**
 * Splits the profile's technologies into "strong" (cited by many facts across roles, safe to claim as
 * a specialty) and "working" (used, but only lightly evidenced, so never present as the specialty).
 */
export function skillEvidenceTiers(resume: MasterResume): { strong: string[]; working: string[] } {
  const weights = skillEvidenceWeights(resume);
  const eligible = new Set(["cat-languages", "cat-frameworks", "cat-cloud", "cat-databases"]);
  const ranked = resume.skills
    .filter((s) => eligible.has(s.categoryId) && (weights.get(s.id) ?? 0) > 0)
    .sort((a, b) => (weights.get(b.id) ?? 0) - (weights.get(a.id) ?? 0));
  return {
    strong: ranked.filter((s) => (weights.get(s.id) ?? 0) >= 3).map((s) => s.name),
    working: ranked.filter((s) => (weights.get(s.id) ?? 0) < 3).map((s) => s.name),
  };
}

function scoreSkills(
  resume: MasterResume,
  analysis: JobAnalysis,
  family?: RoleFamily,
): Map<string, number> {
  const score = new Map<string, number>();
  const bump = (id: string, w: number) => score.set(id, (score.get(id) ?? 0) + w);

  for (const chip of analysis.terms) {
    if (chip.status === "matched") {
      for (const id of skillIdForTerm(chip.term, resume)) bump(id, 6);
    } else if (chip.status === "related") {
      for (const id of skillIdForTerm(chip.term, resume)) bump(id, 3);
      const via = relatedVia(chip.term, resume);
      if (via) for (const id of skillIdForTerm(via, resume)) bump(id, 2);
    }
  }

  for (const [id, w] of skillEvidenceWeights(resume)) bump(id, Math.min(5, w * 1.2));

  if (family) {
    const prio = family.priorityCategoryIds;
    for (const s of resume.skills) {
      const pos = prio.indexOf(s.categoryId);
      if (pos >= 0) bump(s.id, Math.max(0.5, 2 - pos * 0.4));
    }
  }
  return score;
}

export function buildSkillCandidateSet(
  resume: MasterResume,
  analysis: JobAnalysis,
  family: RoleFamily,
): string[] {
  const skillById = new Map(resume.skills.map((s) => [s.id, s]));
  const selected: string[] = [];
  const push = (id: string) => {
    if (!skillById.has(id) || selected.includes(id)) return;
    const skill = skillById.get(id)!;
    if (hasForeignTerm(skill.name, analysis)) return;
    selected.push(id);
  };

  for (const chip of analysis.terms) {
    if (chip.status === "matched") {
      for (const id of skillIdForTerm(chip.term, resume)) push(id);
    }
  }

  for (const chip of analysis.terms) {
    if (chip.status === "related") {
      for (const id of skillIdForTerm(chip.term, resume)) push(id);
      const via = relatedVia(chip.term, resume);
      if (via) for (const id of skillIdForTerm(via, resume)) push(id);
    }
  }

  for (const id of factLinkedSkillIds(resume)) push(id);

  const matchedCats = new Set(selected.map((id) => skillById.get(id)!.categoryId));
  for (const s of resume.skills) {
    if (matchedCats.has(s.categoryId)) push(s.id);
  }

  for (const catId of family.priorityCategoryIds) {
    for (const s of resume.skills) {
      if (s.categoryId === catId) push(s.id);
    }
  }

  for (const s of resume.skills) push(s.id);

  return selected;
}

/** Skills every non-empty category keeps (in order of importance) before anything else is cut. */
const CATEGORY_FLOORS = [3, 2, 1, 0];

export function trimAndFillSkills(
  resume: MasterResume,
  analysis: JobAnalysis,
  orderedIds: string[],
  family?: RoleFamily,
): { selectedSkillIds: string[]; skillCategoryOrder: string[] } {
  const skillById = new Map(resume.skills.map((s) => [s.id, s]));
  const resolve = buildSkillResolver(resume);
  const nameSeen = new Set<string>();
  let selected: string[] = [];
  for (const raw of orderedIds) {
    const id = resolve(raw);
    if (!id || selected.includes(id)) continue;
    const nameKey = skillById.get(id)!.name.toLowerCase();
    if (nameSeen.has(nameKey)) continue;
    nameSeen.add(nameKey);
    selected.push(id);
  }
  if (!selected.length) {
    selected = resume.skills.map((s) => s.id);
  }

  const catOrder = resume.skillCategories.map((c) => c.id);
  const linesFor = (ids: string[]) =>
    countSkillLines(
      catOrder.map((cid) => ({
        categoryId: cid,
        names: ids
          .filter((id) => skillById.get(id)?.categoryId === cid)
          .map((id) => skillById.get(id)!.name),
      })),
    );

  const budget = analysis.lineBudgets.skillsMaxLines;
  const score = scoreSkills(resume, analysis, family);
  // Tiny order bias keeps the AI/relevance order as a tie-breaker.
  const orderBias = new Map(selected.map((id, i) => [id, (selected.length - i) / (selected.length * 100)]));
  const keepScore = (id: string) => (score.get(id) ?? 0) + (orderBias.get(id) ?? 0);

  // Fill: the AI/candidate list may be a subset; add back the best remaining skills that fit.
  const rest = resume.skills
    .map((s) => s.id)
    .filter((id) => {
      if (selected.includes(id)) return false;
      const nameKey = skillById.get(id)!.name.toLowerCase();
      return !nameSeen.has(nameKey) && !hasForeignTerm(skillById.get(id)!.name, analysis);
    })
    .sort((a, b) => keepScore(b) - keepScore(a));
  for (const id of rest) {
    selected.push(id);
    nameSeen.add(skillById.get(id)!.name.toLowerCase());
  }

  // Trim: remove the least valuable skill that does not take its category below the floor.
  let guard = 0;
  for (const floor of CATEGORY_FLOORS) {
    while (linesFor(selected) > budget && guard++ < 400) {
      const counts = new Map<string, number>();
      for (const id of selected) {
        const c = skillById.get(id)!.categoryId;
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
      let victim: string | undefined;
      for (const id of selected) {
        const c = skillById.get(id)!.categoryId;
        if ((counts.get(c) ?? 0) <= floor) continue;
        if (victim === undefined || keepScore(id) < keepScore(victim)) victim = id;
      }
      if (victim === undefined) break;
      selected = selected.filter((id) => id !== victim);
    }
    if (linesFor(selected) <= budget) break;
  }

  // Order inside the block: strongest first (stable), so each category leads with its best skills.
  selected = [...selected].sort((a, b) => keepScore(b) - keepScore(a));

  const priorityCats = [
    ...new Set(selected.map((id) => skillById.get(id)!.categoryId)),
    ...catOrder,
  ];

  return { selectedSkillIds: selected, skillCategoryOrder: priorityCats };
}

export function deterministicSkillOrder(
  resume: MasterResume,
  analysis: JobAnalysis,
  family: RoleFamily,
): { selectedSkillIds: string[]; skillCategoryOrder: string[] } {
  const candidates = buildSkillCandidateSet(resume, analysis, family);
  return trimAndFillSkills(resume, analysis, candidates, family);
}
