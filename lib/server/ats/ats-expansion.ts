import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { classifyJdTermKind, isHiringCompanyTerm } from "./jd-dynamic-vocab";
import { mapFactToJdEvidence } from "./evidence-mapper";
import {
  findTaxonomyTermByName,
  getTransferableTerm,
  getVerifiedTaxonomyIds,
} from "./taxonomy";
import { relatedVia } from "./profile-vocab";

export type ExpansionChannel = "summary" | "experience" | "project" | "skills";

export type ExpansionTarget = {
  phrase: string;
  canonical: string;
  channel: ExpansionChannel;
  bridgeReason: string;
  priority: number;
};

export type ExpansionContext = {
  hiringCompanyNames?: string[];
};

const BLOCKED_PHRASE_RE =
  /\b(equal opportunity|eoe|compensation|benefits package|visa sponsorship|apply now|about us)\b/i;

type FactItem = MasterResume["summaryFacts"][number];

function expansionCtx(analysis?: JobAnalysis): ExpansionContext {
  return { hiringCompanyNames: analysis?.hiringCompanyNames ?? [] };
}

function degreeCorpus(resume: MasterResume): string {
  return resume.education.map((e) => `${e.degree} ${e.institution}`).join(" ");
}

function factDomainFlags(resume: MasterResume): {
  fintech: boolean;
  healthcare: boolean;
  hasDegree: boolean;
  seDegree: boolean;
} {
  const corpus = [
    ...resume.experience.flatMap((e) => e.facts.map((f) => f.text)),
    ...resume.projects.flatMap((p) => p.facts.map((f) => f.text)),
  ].join(" ").toLowerCase();
  const deg = degreeCorpus(resume).toLowerCase();
  return {
    fintech: /\b(fintech|loan|mortgage|payment|financial|bank|asset|liabilit)\b/.test(corpus),
    healthcare: /\b(healthcare|pharmacy|clinical|patient)\b/.test(corpus),
    hasDegree: deg.length > 3,
    seDegree: /\b(software engineering|computer science|cs\b)/.test(deg),
  };
}

function tokenOverlap(term: string, resume: MasterResume): boolean {
  const words = term.toLowerCase().split(/[^a-z0-9.+#]+/).filter((w) => w.length >= 3);
  if (!words.length) return false;
  const corpus = [
    ...resume.skills.map((s) => s.name),
    ...resume.experience.flatMap((e) => e.facts.flatMap((f) => [f.text, ...(f.skills ?? [])])),
  ]
    .join(" ")
    .toLowerCase();
  return words.some((w) => corpus.includes(w));
}

/**
 * JD term is safe to weave when we have a defensible bridge, even if status is "missing".
 * Works for taxonomy terms AND arbitrary phrases extracted from the job description.
 */
export function expansionBridgeReason(
  term: string,
  resume: MasterResume,
  ctx: ExpansionContext = {},
): string | undefined {
  const lower = term.toLowerCase().trim();
  if (lower.length < 2) return undefined;
  if (BLOCKED_PHRASE_RE.test(term)) return undefined;
  if (isHiringCompanyTerm(term, ctx.hiringCompanyNames ?? [])) return undefined;

  const tax = findTaxonomyTermByName(term);
  const domains = factDomainFlags(resume);
  const kind = tax?.kind ?? classifyJdTermKind(term);

  if (tax) {
    const via = relatedVia(term, resume);
    if (via) return `transferable from ${via}`;

    const verified = getVerifiedTaxonomyIds(resume);
    const peer = getTransferableTerm(tax.id, verified);
    if (peer) return `peer stack: ${peer}`;

    if (kind === "soft" || kind === "concept") {
      if (resume.experience.length > 0) return "supported by engineering delivery scope";
    }

    if (tax.id === "payments" || /fraud|aml|kyc|risk/.test(lower)) {
      if (domains.fintech) return "financial/mortgage platform work";
    }
    if (/fraud/.test(lower) && domains.fintech) {
      return "loan and financial workflow integrity";
    }
    if (/data structure/.test(lower) && domains.seDegree) {
      return "software engineering degree foundation";
    }
    if (/computer science/.test(lower) && domains.seDegree) {
      return "software engineering / CS training";
    }
  }

  if (!resume.experience.length) return undefined;

  const dynamicKind = classifyJdTermKind(term);
  if (dynamicKind === "soft") return "professional delivery wording (JD soft skill)";
  if (dynamicKind === "industry") {
    if (domains.fintech && /financ|bank|fraud|payment|mortgage/.test(lower)) {
      return "fintech / financial domain experience";
    }
    if (domains.healthcare && /health|pharma|clinical|hipaa/.test(lower)) {
      return "healthcare domain experience";
    }
    return "domain alignment from cross-industry delivery";
  }
  if (dynamicKind === "concept") return "JD concept — align with verified project scope";
  if (dynamicKind === "tool") {
    if (tokenOverlap(term, resume)) return "adjacent stack on profile";
    const via = relatedVia(term, resume);
    if (via) return `transferable from ${via}`;
    return "job description stack — surface in tailored skills and bullets";
  }

  return undefined;
}

export function isExpansionAllowed(
  term: string,
  resume: MasterResume,
  ctx?: ExpansionContext,
): boolean {
  return Boolean(expansionBridgeReason(term, resume, ctx));
}

/** Terms that may appear in tailored text even though they are not on the master resume. */
export function narrativeAllowTerms(
  terms: JobAnalysis["terms"],
  resume: MasterResume,
  analysis?: JobAnalysis,
): string[] {
  const ctx = expansionCtx(analysis);
  const allowed: string[] = [];
  for (const chip of terms) {
    if (chip.status === "matched") continue;
    const reason = expansionBridgeReason(chip.term, resume, ctx);
    if (!reason) continue;
    allowed.push(chip.term);
    for (const f of chip.surfaceForms ?? []) allowed.push(f);
  }
  return [...new Set(allowed)];
}

/** JD tools/concepts to add to the tailored skills block (includes dynamic JD-only terms). */
export function expansionSkillInjections(
  resume: MasterResume,
  analysis: JobAnalysis,
): MasterResume["skills"] {
  const ctx = expansionCtx(analysis);
  const existing = new Set(resume.skills.map((s) => s.name.toLowerCase()));
  const out: MasterResume["skills"] = [];
  const catByFamily: Record<string, string> = {
    cloud: "cat-cloud",
    devops: "cat-devops",
    data: "cat-databases",
    api: "cat-api",
    js: "cat-frameworks",
    python: "cat-languages",
    process: "cat-vcs",
    architecture: "cat-architecture",
    ai: "cat-ai",
    domain: "cat-architecture",
    "jd-dynamic": "cat-architecture",
  };

  for (const chip of analysis.terms) {
    if (chip.status === "matched") continue;
    const tax = findTaxonomyTermByName(chip.term);
    const kind = tax?.kind ?? chip.termKind ?? classifyJdTermKind(chip.term);
    if (classifyJdTermKind(chip.term) === "noise") continue;
    if (isHiringCompanyTerm(chip.term, ctx.hiringCompanyNames ?? [])) continue;
    if (kind !== "soft" && !expansionBridgeReason(chip.term, resume, ctx)) continue;
    if (kind === "soft" && !resume.experience.length) continue;

    const display = chip.surfaceForms?.[0] ?? tax?.canonical ?? chip.term;
    const name = display.length <= 42 ? display : tax?.canonical ?? chip.term;
    if (existing.has(name.toLowerCase())) continue;

    const id = tax?.id ? `expansion-${tax.id}` : `expansion-jd-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`;
    if (out.some((s) => s.id === id)) continue;
    out.push({
      id,
      name,
      categoryId:
        kind === "soft" ? "cat-vcs" : catByFamily[tax?.family ?? "jd-dynamic"] ?? "cat-architecture",
      aliases: (chip.surfaceForms ?? []).filter((f) => f.toLowerCase() !== name.toLowerCase()),
      userAttested: false,
    });
    existing.add(name.toLowerCase());
  }
  return out.slice(0, 24);
}

export function mergeResumeWithExpansionSkills(
  resume: MasterResume,
  analysis: JobAnalysis,
): MasterResume {
  const extra = expansionSkillInjections(resume, analysis);
  if (!extra.length) return resume;
  return { ...resume, skills: [...resume.skills, ...extra] };
}

function supportScore(fact: FactItem, canonical: string, analysis: JobAnalysis): number {
  const ev = mapFactToJdEvidence(fact, analysis);
  const head = canonical.toLowerCase();
  if (ev.directKeywords.some((k) => k.toLowerCase() === head)) return 5;
  if (ev.bridgedPhrases.some((b) => b.toLowerCase().includes(head))) return 4;
  return 1;
}

export function buildExpansionTargets(
  resume: MasterResume,
  analysis: JobAnalysis,
): ExpansionTarget[] {
  const ctx = expansionCtx(analysis);
  const targets: ExpansionTarget[] = [];
  const domains = factDomainFlags(resume);

  const push = (
    phrase: string,
    canonical: string,
    channel: ExpansionChannel,
    bridgeReason: string,
    priority: number,
  ) => {
    if (!phrase || BLOCKED_PHRASE_RE.test(phrase)) return;
    if (isHiringCompanyTerm(canonical, ctx.hiringCompanyNames ?? [])) return;
    if (targets.some((t) => t.phrase.toLowerCase() === phrase.toLowerCase())) return;
    targets.push({ phrase, canonical, channel, bridgeReason, priority });
  };

  for (const chip of analysis.terms) {
    const bridge =
      chip.status === "matched" ? "on profile" : expansionBridgeReason(chip.term, resume, ctx);
    if (!bridge && chip.status !== "matched") continue;

    const tax = findTaxonomyTermByName(chip.term);
    const kind = tax?.kind ?? chip.termKind ?? classifyJdTermKind(chip.term);
    const forms = chip.surfaceForms?.length ? chip.surfaceForms : [chip.term];
    const phrase = forms[0]!;
    const priority =
      chip.status === "matched" ? 3 : kind === "soft" ? 0 : kind === "concept" ? 1 : 2;

    let channel: ExpansionChannel = "experience";
    if (kind === "soft") channel = "summary";
    else if (kind === "tool" && chip.status !== "matched") channel = "experience";

    const reason = bridge ?? (chip.status === "related" ? "related JD vocabulary" : "JD keyword alignment");
    push(phrase, chip.term, channel, reason, priority + (chip.status === "missing" ? 0 : 2));
    if (kind === "tool" && chip.status !== "matched") {
      push(phrase, chip.term, "skills", reason, priority - 1);
    }
  }

  targets.sort((a, b) => a.priority - b.priority);
  return targets.slice(0, 36);
}

export function expansionSummaryPhrases(targets: ExpansionTarget[]): string[] {
  return targets.filter((t) => t.channel === "summary").map((t) => t.phrase).slice(0, 6);
}

export function planExpansionPhraseMap(
  resume: MasterResume,
  analysis: JobAnalysis,
): Map<string, string[]> {
  const targets = buildExpansionTargets(resume, analysis).filter(
    (t) => t.channel === "experience" || t.channel === "project",
  );
  const slots = [
    ...resume.experience.flatMap((e) => e.facts.map((f) => f.id)),
    ...resume.projects.flatMap((p) => p.facts.map((f) => f.id)),
  ];
  const facts = new Map<string, FactItem>();
  for (const e of resume.experience) for (const f of e.facts) facts.set(f.id, f);
  for (const p of resume.projects) for (const f of p.facts) facts.set(f.id, f);

  const plan = new Map<string, string[]>();
  const counts = new Map<string, number>();
  let i = 0;
  for (const t of targets) {
    const ranked = slots
      .map((id) => ({
        id,
        score: supportScore(facts.get(id)!, t.canonical, analysis),
      }))
      .filter((x) => (counts.get(x.id) ?? 0) < 2)
      .sort((a, b) => b.score - a.score || (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0));
    const pick = ranked[0];
    if (!pick || pick.score < 1) continue;
    const list = plan.get(pick.id) ?? [];
    if (!list.some((p) => p.toLowerCase() === t.phrase.toLowerCase())) list.push(t.phrase);
    plan.set(pick.id, list);
    counts.set(pick.id, list.length);
    i++;
    if (i >= 30) break;
  }
  return plan;
}

export function formatExpansionPromptBlock(resume: MasterResume, analysis: JobAnalysis): string {
  const targets = buildExpansionTargets(resume, analysis);
  if (!targets.length) return "";
  const lines = targets.map((t) => `• "${t.phrase}" → ${t.channel} (${t.bridgeReason})`);
  return [
    "ATS gap-fill (this job's vocabulary — not limited to the static skill list; weave exact JD phrases into the assigned sections using only verified employers, dates, and metrics):",
    ...lines,
  ].join("\n");
}
