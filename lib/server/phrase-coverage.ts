import type { MasterResume, ResumeView } from "@/lib/schemas/resume";
import type { JobAnalysis, TailoringResult } from "@/lib/schemas/tailoring";
import {
  buildExpansionTargets,
  expansionBridgeReason,
  expansionSummaryPhrases,
  planExpansionPhraseMap,
} from "./ats-expansion";
import { mapFactToJdEvidence } from "./evidence-mapper";
import { findTaxonomyTermByName } from "./taxonomy";
import { classifyJdTermKind, isHiringCompanyTerm } from "./jd-dynamic-vocab";
import { buildJdPhraseTargets, preferredJdSurface } from "./jd-exact-phrases";
import { fitToMaxBulletLines, fitToMaxWrappedLines } from "@/lib/layout/text-fit";
import {
  COLUMN_WIDTH,
  SIZE_BODY,
  TAILOR_BULLET_MAX_LINES,
  TAILOR_PROJECT_MAX_LINES,
} from "@/lib/layout/constants";

type FactItem = MasterResume["summaryFacts"][number];

function projectsForWeave(resume: MasterResume, analysis: JobAnalysis) {
  const ids = analysis.selectedProjectIds;
  if (!ids?.length) return resume.projects;
  const set = new Set(ids);
  return resume.projects.filter((p) => set.has(p.id));
}

const VERB_PHRASE = /^(improve|build|design|lead|maintain|collaborate|monitor|write|develop|deliver|ensure|provide|create|manage|support|drive|scale|optimize|optimise)\b/i;

function hasPhrase(text: string, phrase: string): boolean {
  if (phrase.length < 2) return false;
  const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![A-Za-z0-9])${esc}(?![A-Za-z0-9])`, "i").test(text);
}

function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

/** Weave exact JD wording into bullets/projects (ATS counts narrative, not skills list alone). */
export function weavePhrases(text: string, phrases: string[], maxPhrases = 3): string {
  const missing = phrases
    .filter(
      (p, i) =>
        !hasPhrase(text, p) &&
        !phrases.some((other, j) => j !== i && other.length > p.length && hasPhrase(other, p)),
    )
    .sort((a, b) => a.length - b.length);
  if (!missing.length) return text;
  const pick = missing.slice(0, maxPhrases);
  const nouns = pick.filter((p) => !VERB_PHRASE.test(p));
  const verbs = pick.filter((p) => VERB_PHRASE.test(p));
  const base = text.replace(/[.\s]+$/, "");
  const bits: string[] = [];
  if (nouns.length) bits.push(`including ${joinAnd(nouns)}`);
  if (verbs.length) bits.push(joinAnd(verbs.map((v) => `ability to ${v.replace(/^to\s+/i, "")}`)));
  if (!bits.length) return text;
  return `${base}, ${bits.join(", ")}.`;
}

function labelMatches(label: string, canonical: string): boolean {
  const head = label.split(" (")[0]!.split(" [")[0]!.trim().toLowerCase();
  return head === canonical.toLowerCase();
}

function supportScore(
  fact: FactItem,
  canonical: string,
  analysis: JobAnalysis,
  resume: MasterResume,
): number {
  const ev = mapFactToJdEvidence(fact, analysis);
  if (ev.directKeywords.some((k) => labelMatches(k, canonical))) return 5;
  if (ev.bridgedPhrases.some((b) => labelMatches(b, canonical))) return 4;
  if (expansionBridgeReason(canonical, resume, { hiringCompanyNames: analysis.hiringCompanyNames })) return 2;
  const chip = analysis.terms.find((t) => t.term.toLowerCase() === canonical.toLowerCase());
  if (chip && chip.status !== "matched" && !isHiringCompanyTerm(chip.term, analysis.hiringCompanyNames ?? [])) {
    return 2;
  }
  return 0;
}

type Slot = { factId: string; section: "experience" | "project" };

function mergePlans(a: Map<string, string[]>, b: Map<string, string[]>): Map<string, string[]> {
  const out = new Map(a);
  for (const [id, phrases] of b) {
    const list = [...(out.get(id) ?? [])];
    for (const p of phrases) {
      if (!list.some((x) => x.toLowerCase() === p.toLowerCase())) list.push(p);
    }
    if (list.length) out.set(id, list);
  }
  return out;
}

function planProfilePhrasePlacements(
  resume: MasterResume,
  analysis: JobAnalysis,
): Map<string, string[]> {
  const slots: Slot[] = [
    ...resume.experience.flatMap((e) => e.facts.map((f) => ({ factId: f.id, section: "experience" as const }))),
    ...projectsForWeave(resume, analysis).flatMap((p) =>
      p.facts.map((f) => ({ factId: f.id, section: "project" as const })),
    ),
  ];
  const facts = new Map<string, FactItem>();
  for (const e of resume.experience) for (const f of e.facts) facts.set(f.id, f);
  for (const p of projectsForWeave(resume, analysis)) for (const f of p.facts) facts.set(f.id, f);

  const phrases: { phrase: string; canonical: string; rank: number; gap: number }[] = [];
  for (const chip of analysis.terms) {
    if (isHiringCompanyTerm(chip.term, analysis.hiringCompanyNames ?? [])) continue;
    const tax = findTaxonomyTermByName(chip.term);
    const kind = tax?.kind ?? chip.termKind ?? classifyJdTermKind(chip.term);
    if (kind === "noise") continue;
    const rank = kind === "soft" ? 0 : kind === "concept" ? 1 : 2;
    const gap = chip.status === "missing" ? 0 : chip.status === "related" ? 1 : 2;
    const surface = preferredJdSurface(chip, analysis.hiringCompanyNames ?? []);
    const forms = surface ? [surface] : chip.surfaceForms?.length ? chip.surfaceForms : [chip.term];
    for (const phrase of forms) {
      if (phrases.some((p) => p.phrase.toLowerCase() === phrase.toLowerCase())) continue;
      if (phrases.some((p) => p.phrase.length > phrase.length && hasPhrase(p.phrase, phrase))) continue;
      for (let i = phrases.length - 1; i >= 0; i--) {
        const prev = phrases[i]!;
        if (phrase.length > prev.phrase.length && hasPhrase(phrase, prev.phrase)) phrases.splice(i, 1);
      }
      phrases.push({ phrase, canonical: chip.term, rank, gap });
    }
  }
  phrases.sort((a, b) => a.gap - b.gap || a.rank - b.rank);

  const counts = new Map<string, number>();
  const plan = new Map<string, string[]>();
  const taken = (id: string) => counts.get(id) ?? 0;
  const give = (id: string, phrase: string) => {
    const list = plan.get(id) ?? [];
    if (list.some((p) => p.toLowerCase() === phrase.toLowerCase())) return;
    list.push(phrase);
    plan.set(id, list);
    counts.set(id, list.length);
  };

  let placed = 0;
  for (const item of phrases) {
    if (placed >= 30) break;
    const ranked = slots
      .map((slot) => ({
        slot,
        score: supportScore(facts.get(slot.factId)!, item.canonical, analysis, resume),
      }))
      .filter((x) => x.score >= 1 && taken(x.slot.factId) < 2)
      .sort((a, b) => {
        const projectBias = placed % 3 === 2 ? 1 : 0;
        const sec = (s: Slot) => (s.section === "project" ? projectBias : 1 - projectBias);
        return b.score + sec(b.slot) - (a.score + sec(a.slot)) || taken(a.slot.factId) - taken(b.slot.factId);
      });
    const best = ranked[0] ?? {
      slot: slots[placed % slots.length]!,
      score: 1,
    };
    if (!best?.slot) continue;
    give(best.slot.factId, item.phrase);
    placed += 1;
  }
  return plan;
}

function enforceJdExactSurfaces(
  result: TailoringResult,
  resume: MasterResume,
  analysis: JobAnalysis,
): TailoringResult {
  const targets = buildJdPhraseTargets(analysis).slice(0, 34);
  if (!targets.length) return result;

  let summary = result.summary;
  const experience = result.experience.map((e) => ({
    ...e,
    bullets: e.bullets.map((b) => ({ ...b })),
  }));
  const projects = result.projects.map((p) => ({ ...p }));

  const corpus = () =>
    [
      summary,
      ...experience.flatMap((e) => e.bullets.map((b) => b.text)),
      ...projects.map((p) => p.description),
    ].join("\n");

  const bulletSlots: { expIdx: number; bulletIdx: number }[] = [];
  experience.forEach((exp, ei) => {
    exp.bullets.forEach((_, bi) => bulletSlots.push({ expIdx: ei, bulletIdx: bi }));
  });
  let rot = 0;

  for (const t of targets) {
    if (hasPhrase(corpus(), t.phrase)) continue;

    if (t.kind === "soft" || t.kind === "industry") {
      summary = weavePhrases(summary, [t.phrase], 2);
      continue;
    }

    if (bulletSlots.length) {
      const { expIdx, bulletIdx } = bulletSlots[rot % bulletSlots.length]!;
      rot += 1;
      const b = experience[expIdx]!.bullets[bulletIdx]!;
      b.text = weavePhrases(b.text, [t.phrase], 2);
      continue;
    }

    if (projects[0]) {
      projects[0].description = weavePhrases(projects[0].description, [t.phrase], 2);
    }
  }

  return { ...result, summary, experience, projects };
}

export function planPhrasePlacements(
  resume: MasterResume,
  analysis: JobAnalysis,
): Map<string, string[]> {
  return mergePlans(planProfilePhrasePlacements(resume, analysis), planExpansionPhraseMap(resume, analysis));
}

export function phraseInstructions(factIds: string[], plan: Map<string, string[]>): string {
  const lines = factIds.flatMap((id) => {
    const phrases = plan.get(id);
    if (!phrases?.length) return [];
    return [`- ${id}: use this exact wording: ${phrases.map((p) => `"${p}"`).join(", ")}`];
  });
  if (!lines.length) return "";
  return [
    "Exact JD phrases for this section. A scanner counts a hard or soft skill as missing until this wording appears in the bullet or project text itself:",
    ...lines,
  ].join("\n");
}

function withoutAlreadyPresent(plan: Map<string, string[]>, text: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [id, phrases] of plan) {
    const keep = phrases.filter((p) => !hasPhrase(text, p));
    if (keep.length) out.set(id, keep);
  }
  return out;
}

function weaveOwned(
  text: string,
  factIds: string[],
  plan: Map<string, string[]>,
  used: Set<string>,
): string {
  const phrases: string[] = [];
  for (const id of factIds) {
    if (used.has(id)) continue;
    used.add(id);
    for (const p of plan.get(id) ?? []) {
      if (!phrases.some((x) => x.toLowerCase() === p.toLowerCase())) phrases.push(p);
    }
  }
  return phrases.length ? weavePhrases(text, phrases) : text;
}

export function applyPhraseCoverage(
  result: TailoringResult,
  resume: MasterResume,
  analysis: JobAnalysis,
): TailoringResult {
  const existing = [
    result.summary,
    ...result.experience.flatMap((e) => e.bullets.map((b) => b.text)),
    ...result.projects.map((p) => p.description),
  ].join("\n");
  const plan = withoutAlreadyPresent(planPhrasePlacements(resume, analysis), existing);
  const summaryPhrases = expansionSummaryPhrases(buildExpansionTargets(resume, analysis)).filter(
    (p) => !hasPhrase(result.summary, p),
  );

  let summary = result.summary;
  if (summaryPhrases.length) summary = weavePhrases(summary, summaryPhrases);

  const used = new Set<string>();

  const experience = result.experience.map((exp) => ({
    ...exp,
    bullets: exp.bullets.map((b) => ({
      ...b,
      text: weaveOwned(b.text, b.sourceFactIds, plan, used),
    })),
  }));

  const projects = result.projects.map((p) => ({
    ...p,
    description: weaveOwned(p.description, p.sourceFactIds, plan, used),
  }));

  for (const [factId, phrases] of plan) {
    if (used.has(factId)) continue;
    const role = resume.experience.find((e) => e.facts.some((f) => f.id === factId));
    const block = role ? experience.find((e) => e.experienceId === role.id) : undefined;
    const bullet = block?.bullets[block.bullets.length - 1];
    if (bullet) {
      bullet.text = weavePhrases(bullet.text, phrases);
      used.add(factId);
      continue;
    }
    const proj = projectsForWeave(resume, analysis).find((p) => p.facts.some((f) => f.id === factId));
    const blockP = proj ? projects.find((p) => p.projectId === proj.id) : undefined;
    if (blockP) {
      blockP.description = weavePhrases(blockP.description, phrases);
      used.add(factId);
    }
  }

  const clampedExperience = experience.map((exp) => ({
    ...exp,
    bullets: exp.bullets.map((b) => ({
      ...b,
      text: fitToMaxBulletLines(b.text, TAILOR_BULLET_MAX_LINES),
    })),
  }));
  const clampedProjects = projects.map((p) => ({
    ...p,
    description: fitToMaxWrappedLines(p.description, TAILOR_PROJECT_MAX_LINES, COLUMN_WIDTH, SIZE_BODY),
  }));

  const withExact = enforceJdExactSurfaces(
    { ...result, summary, experience: clampedExperience, projects: clampedProjects },
    resume,
    analysis,
  );

  return {
    ...withExact,
    experience: withExact.experience.map((exp) => ({
      ...exp,
      bullets: exp.bullets.map((b) => ({
        ...b,
        text: fitToMaxBulletLines(b.text, TAILOR_BULLET_MAX_LINES),
      })),
    })),
    projects: withExact.projects.map((p) => ({
      ...p,
      description: fitToMaxWrappedLines(p.description, TAILOR_PROJECT_MAX_LINES, COLUMN_WIDTH, SIZE_BODY),
    })),
  };
}

export function coverResumeView(
  view: ResumeView,
  resume: MasterResume,
  analysis: JobAnalysis,
): ResumeView {
  const fake: TailoringResult = {
    headline: view.headline,
    summary: view.summary,
    selectedSkillIds: view.skills.flatMap((c) => c.items.map((i) => i.id)),
    skillCategoryOrder: view.skills.map((c) => c.categoryId),
    experience: view.experience.map((e) => ({
      experienceId: e.id,
      bullets: e.bullets,
    })),
    projects: view.projects.map((p) => ({
      projectId: p.id,
      description: p.description,
      sourceFactIds: p.sourceFactIds,
    })),
    requirementNotes: [],
    warnings: [],
  };
  const expanded = applyPhraseCoverage(fake, resume, analysis);
  return {
    ...view,
    summary: expanded.summary,
    experience: view.experience.map((e) => {
      const block = expanded.experience.find((x) => x.experienceId === e.id);
      return block ? { ...e, bullets: block.bullets } : e;
    }),
    projects: view.projects.map((p) => {
      const block = expanded.projects.find((x) => x.projectId === p.id);
      return block ? { ...p, description: block.description } : p;
    }),
  };
}
