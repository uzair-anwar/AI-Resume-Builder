import { columnWidth, bodySize } from "./active";
import type { MasterResume } from "@/lib/schemas/resume";
import { SUMMARY_MAX_LINES, SKILLS_MAX_LINES } from "./constants";
import { countBulletLines, countProjectBulletLines, countWrappedLines } from "./measure";

import { skillLines, type SkillCategoryInput } from "./skill-line";
import { activeProfile, tailorCaps } from "./profile";
import { buildSkillInputs } from "@/lib/skills/skill-inputs";

export type LineBudgets = {
  summaryMaxLines: number;
  skillsMaxLines: number;
  bullets: Record<string, number>;
  projects: Record<string, number>;
};

/** Per-fact caps for tailoring: mostly 2–3 line bullets so JD terms stay in narrative text. */
export function applyTailorLineBudgetCaps(budgets: LineBudgets, resume: MasterResume): LineBudgets {
  const caps = tailorCaps();
  const TAILOR_BULLET_MAX_LINES = caps.bulletMax;
  const TAILOR_BULLET_MIN_LINES = caps.bulletMin;
  const TAILOR_PROJECT_MAX_LINES = caps.projectMax;
  const TAILOR_SUMMARY_MAX_LINES = caps.summaryMax;
  const bullets: Record<string, number> = {};
  for (const exp of resume.experience) {
    const dense = exp.facts.length >= 6;
    exp.facts.forEach((f, i) => {
      if (caps.exactBullets) {
        bullets[f.id] = Math.max(1, budgets.bullets[f.id] ?? TAILOR_BULLET_MAX_LINES);
        return;
      }
      const natural = Math.min(
        budgets.bullets[f.id] ?? TAILOR_BULLET_MAX_LINES,
        TAILOR_BULLET_MAX_LINES,
      );
      const staggered = dense
        ? i % 2 === 0
          ? TAILOR_BULLET_MAX_LINES
          : TAILOR_BULLET_MIN_LINES
        : natural;
      bullets[f.id] = Math.max(
        TAILOR_BULLET_MIN_LINES,
        Math.min(TAILOR_BULLET_MAX_LINES, staggered),
      );
    });
  }
  const projects: Record<string, number> = {};
  for (const [id, lines] of Object.entries(budgets.projects)) {
    projects[id] = Math.min(lines, TAILOR_PROJECT_MAX_LINES);
  }
  return {
    ...budgets,
    summaryMaxLines: caps.exactBullets
      ? budgets.summaryMaxLines
      : Math.min(budgets.summaryMaxLines, TAILOR_SUMMARY_MAX_LINES),
    skillsMaxLines: budgets.skillsMaxLines,
    bullets,
    projects,
  };
}

/** Max lines the tailored summary may use (exactly the master's lines when the template is tight). */
export function summaryLineCap(budgets: LineBudgets): number {
  if (tailorCaps().exactBullets) return budgets.summaryMaxLines;
  return Math.min(SUMMARY_MAX_LINES, budgets.summaryMaxLines + 1);
}

export function computeLineBudgets(resume: MasterResume): LineBudgets {
  const defaultSummary = resume.summaryFacts.map((f) => f.text).join(" ");
  const naturalSummary = countWrappedLines(defaultSummary, columnWidth(), bodySize());
  const summaryMaxLines = tailorCaps().exactBullets
    ? naturalSummary
    : Math.min(SUMMARY_MAX_LINES, naturalSummary);

  const bullets: Record<string, number> = {};
  for (const exp of resume.experience) {
    for (const f of exp.facts) {
      bullets[f.id] = countBulletLines(f.text);
    }
  }

  const projects: Record<string, number> = {};
  for (const p of resume.projects) {
    if (activeProfile().projectStyle === "bullets") {
      projects[p.id] = p.facts.reduce((n, f) => n + countProjectBulletLines(f.text), 0);
      continue;
    }
    const text = p.facts.map((f) => f.text).join(" ");
    projects[p.id] = countWrappedLines(text, columnWidth(), bodySize());
  }

  const skillLines = countSkillBlockLines(resume);
  const skillsMaxLines = Math.min(tailorCaps().skillsMax, skillLines);

  return {
    summaryMaxLines: summaryMaxLines || SUMMARY_MAX_LINES,
    skillsMaxLines: skillsMaxLines || SKILLS_MAX_LINES,
    bullets,
    projects,
  };
}

/**
 * Lines used by the skills block: per non-empty category the wrapped skill lines of the active
 * template, plus a label line when the template prints the label above the items.
 */
export function countSkillLines(categories: SkillCategoryInput[]): number {
  const p = activeProfile();
  let lines = 0;
  for (const cat of categories) {
    if (!cat.names.length) continue;
    if (!p.skills.labelInline) lines += 1; // category label line
    lines += skillLines(cat, p.skillsWidth, p.bodySize, p.fontFamily).length;
  }
  return lines;
}

function countSkillBlockLines(resume: MasterResume): number {
  return countSkillLines(
    buildSkillInputs(
      resume,
      resume.skills.map((s) => s.id),
    ),
  );
}

export function maxCharsForLines(maxLines: number, fontSize: number = bodySize()): number {
  return maxLines * charsPerLineApprox(fontSize);
}

function charsPerLineApprox(fontSize: number): number {
  return Math.floor(columnWidth() / (fontSize * 0.52));
}
