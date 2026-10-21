import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { detectRoleFamily } from "./role-families";
import { findTermInText, loadTaxonomy, normalizeText } from "./taxonomy";
import { matchResumeToTerm } from "./taxonomy";

const REQUIREMENT_SECTION_RE =
  /(requirements|qualifications|what you.?ll need|must have|required skills|minimum qualifications)[:\s]*([\s\S]*?)(?=\n\n|responsibilities|about you|benefits|nice to have|preferred|$)/gi;

const PREFERRED_SECTION_RE =
  /(nice to have|preferred|bonus|desired)[:\s]*([\s\S]*?)(?=\n\n|benefits|requirements|$)/gi;

function extractRequirements(jobText: string): string[] {
  const reqs = new Set<string>();
  const lines = jobText.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const bullet = line.replace(/^[-•*]\s*/, "");
    if (bullet.length >= 8 && bullet.length < 200) {
      reqs.add(bullet);
    }
  }

  let m: RegExpExecArray | null;
  const full = jobText;
  REQUIREMENT_SECTION_RE.lastIndex = 0;
  while ((m = REQUIREMENT_SECTION_RE.exec(full))) {
    for (const line of m[2].split(/\n+/)) {
      const t = line.replace(/^[-•*]\s*/, "").trim();
      if (t.length >= 8) reqs.add(t);
    }
  }
  PREFERRED_SECTION_RE.lastIndex = 0;
  while ((m = PREFERRED_SECTION_RE.exec(full))) {
    for (const line of m[2].split(/\n+/)) {
      const t = line.replace(/^[-•*]\s*/, "").trim();
      if (t.length >= 8) reqs.add(`(Preferred) ${t}`);
    }
  }

  const tax = loadTaxonomy();
  for (const term of tax.terms) {
    if (findTermInText(jobText, term)) {
      reqs.add(term.canonical);
    }
  }

  return [...reqs].slice(0, 40);
}

function detectTitle(jobText: string): string | undefined {
  const first = jobText.split("\n").map((l) => l.trim()).find((l) => l.length > 3 && l.length < 120);
  return first;
}

function detectSeniority(jobText: string): string | undefined {
  const hay = normalizeText(jobText);
  if (hay.includes("staff")) return "Staff";
  if (hay.includes("principal")) return "Principal";
  if (hay.includes("senior")) return "Senior";
  if (hay.includes("junior") || hay.includes("entry")) return "Junior";
  return undefined;
}

export function analyzeJob(
  jobText: string,
  resume: MasterResume,
  roleFamilyId?: string,
): JobAnalysis {
  const family = detectRoleFamily(jobText, roleFamilyId);
  const requirements = extractRequirements(jobText);
  const tax = loadTaxonomy();

  const gapAnalysis = requirements.map((req) => {
    let matchedTerm = tax.terms.find((t) => findTermInText(req, t));
    if (!matchedTerm) {
      matchedTerm = tax.terms.find((t) => normalizeText(req).includes(normalizeText(t.canonical)));
    }
    if (matchedTerm) {
      const m = matchResumeToTerm(resume, matchedTerm);
      return {
        requirement: req,
        status: m.status,
        evidenceFactIds: m.factIds,
        transferableVia: m.via,
      };
    }
    const skill = resume.skills.find((s) => normalizeText(req).includes(normalizeText(s.name)));
    if (skill) {
      return { requirement: req, status: "matched" as const, evidenceSkillIds: [skill.id] };
    }
    return { requirement: req, status: "missing" as const };
  });

  const matched = gapAnalysis.filter((g) => g.status === "matched").length;
  const transferable = gapAnalysis.filter((g) => g.status === "transferable").length;
  const missing = gapAnalysis.filter((g) => g.status === "missing").length;

  return {
    detectedTitle: detectTitle(jobText),
    seniority: detectSeniority(jobText),
    roleFamilyId: family.id,
    roleFamilyLabel: family.label,
    requirements,
    gapAnalysis,
    coverage: {
      matched,
      transferable,
      missing,
      total: gapAnalysis.length,
    },
  };
}
