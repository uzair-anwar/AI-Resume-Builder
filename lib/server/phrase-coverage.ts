import type { MasterResume, ResumeView } from "@/lib/schemas/resume";
import type { JobAnalysis, TailoringResult } from "@/lib/schemas/tailoring";
import { mapFactToJdEvidence } from "./evidence-mapper";
import { findTaxonomyTermByName } from "./taxonomy";

type FactItem = MasterResume["summaryFacts"][number];

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

/** Adds the exact JD wording Jobscan looks for, without inventing a new claim. */
export function weavePhrases(text: string, phrases: string[]): string {
  const missing = phrases.filter(
    (p, i) =>
      !hasPhrase(text, p) &&
      !phrases.some((other, j) => j !== i && other.length > p.length && hasPhrase(other, p)),
  );
  if (!missing.length) return text;
  const nouns = missing.filter((p) => !VERB_PHRASE.test(p));
  const verbs = missing.filter((p) => VERB_PHRASE.test(p));
  const bits: string[] = [];
  if (nouns.length) bits.push(`covering ${joinAnd(nouns)}`);
  if (verbs.length) bits.push(joinAnd(verbs.map((v) => `to ${v}`)));
  const base = text.replace(/[.\s]+$/, "");
  return `${base}, ${bits.join(", ")}.`;
}

function labelMatches(label: string, canonical: string): boolean {
  const head = label.split(" (")[0]!.split(" [")[0]!.trim().toLowerCase();
  return head === canonical.toLowerCase();
}

function supportScore(fact: FactItem, canonical: string, analysis: JobAnalysis): number {
  const ev = mapFactToJdEvidence(fact, analysis);
  if (ev.directKeywords.some((k) => labelMatches(k, canonical))) return 5;
  if (ev.bridgedPhrases.some((b) => labelMatches(b, canonical))) return 4;
  return 0;
}

type Slot = { factId: string; section: "experience" | "project" };

/**
 * Assigns each JD hard/soft phrase the profile can support to one experience bullet or project,
 * using the job description's own wording. Tools the candidate has not used are left out.
 */
export function planPhrasePlacements(
  resume: MasterResume,
  analysis: JobAnalysis,
): Map<string, string[]> {
  const slots: Slot[] = [
    ...resume.experience.flatMap((e) => e.facts.map((f) => ({ factId: f.id, section: "experience" as const }))),
    ...resume.projects.flatMap((p) => p.facts.map((f) => ({ factId: f.id, section: "project" as const }))),
  ];
  const facts = new Map<string, FactItem>();
  for (const e of resume.experience) for (const f of e.facts) facts.set(f.id, f);
  for (const p of resume.projects) for (const f of p.facts) facts.set(f.id, f);

  const phrases: { phrase: string; canonical: string; rank: number }[] = [];
  for (const chip of analysis.terms) {
    if (chip.status === "missing") continue;
    const tax = findTaxonomyTermByName(chip.term);
    const kind = tax?.kind ?? "tool";
    if (kind === "tool" && chip.status !== "matched") continue;
    const rank = kind === "soft" ? 0 : kind === "concept" ? 1 : 2;
    const forms = chip.surfaceForms?.length ? chip.surfaceForms : [chip.term];
    for (const phrase of forms) {
      if (phrases.some((p) => p.phrase.toLowerCase() === phrase.toLowerCase())) continue;
      // "technical leadership" already covers the shorter word "leadership".
      if (phrases.some((p) => p.phrase.length > phrase.length && hasPhrase(p.phrase, phrase))) continue;
      for (let i = phrases.length - 1; i >= 0; i--) {
        const prev = phrases[i]!;
        if (phrase.length > prev.phrase.length && hasPhrase(phrase, prev.phrase)) phrases.splice(i, 1);
      }
      phrases.push({ phrase, canonical: chip.term, rank });
    }
  }
  phrases.sort((a, b) => a.rank - b.rank);

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
    if (placed >= 14) break;
    const ranked = slots
      .map((slot) => ({
        slot,
        score: supportScore(facts.get(slot.factId)!, item.canonical, analysis),
      }))
      .filter((x) => x.score > 0 && taken(x.slot.factId) < 2)
      .sort((a, b) => {
        // Spread phrases: projects absorb some so both sections carry JD wording.
        const projectBias = placed % 3 === 2 ? 1 : 0;
        const sec = (s: Slot) => (s.section === "project" ? projectBias : 1 - projectBias);
        return b.score + sec(b.slot) - (a.score + sec(a.slot)) || taken(a.slot.factId) - taken(b.slot.factId);
      });
    const best = ranked[0];
    if (!best) continue;
    give(best.slot.factId, item.phrase);
    placed += 1;
  }
  return plan;
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

/** Drops phrases the tailored text already contains, so a rewrite that kept the wording is left alone. */
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
  if (!plan.size) return result;
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

  // A fact the model dropped still needs its phrase. Attach it to that role's last bullet.
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
    const proj = resume.projects.find((p) => p.facts.some((f) => f.id === factId));
    const blockP = proj ? projects.find((p) => p.projectId === proj.id) : undefined;
    if (blockP) {
      blockP.description = weavePhrases(blockP.description, phrases);
      used.add(factId);
    }
  }

  return { ...result, experience, projects };
}

/** Same placement pass for an already assembled resume view (deterministic fallback). */
export function coverResumeView(
  view: ResumeView,
  resume: MasterResume,
  analysis: JobAnalysis,
): ResumeView {
  const existing = [
    view.summary,
    ...view.experience.flatMap((e) => e.bullets.map((b) => b.text)),
    ...view.projects.map((p) => p.description),
  ].join("\n");
  const plan = withoutAlreadyPresent(planPhrasePlacements(resume, analysis), existing);
  if (!plan.size) return view;
  const used = new Set<string>();
  const experience = view.experience.map((exp) => ({
    ...exp,
    bullets: exp.bullets.map((b) => ({
      ...b,
      text: weaveOwned(b.text, b.sourceFactIds, plan, used),
    })),
  }));
  const projects = view.projects.map((p) => ({
    ...p,
    description: weaveOwned(p.description, p.sourceFactIds, plan, used),
  }));
  for (const [factId, phrases] of plan) {
    if (used.has(factId)) continue;
    const role = resume.experience.find((e) => e.facts.some((f) => f.id === factId));
    const block = role ? experience.find((e) => e.id === role.id) : undefined;
    const bullet = block?.bullets[block.bullets.length - 1];
    if (bullet) {
      bullet.text = weavePhrases(bullet.text, phrases);
      used.add(factId);
      continue;
    }
    const proj = resume.projects.find((p) => p.facts.some((f) => f.id === factId));
    const blockP = proj ? projects.find((p) => p.id === proj.id) : undefined;
    if (blockP) blockP.description = weavePhrases(blockP.description, phrases);
  }
  return { ...view, experience, projects };
}
