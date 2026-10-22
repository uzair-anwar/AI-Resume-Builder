import type { MasterResume } from "@/lib/schemas/resume";
import { SUMMARY_MAX_LINES, SKILLS_MAX_LINES } from "./constants";
import { countBulletLines, countWrappedLines } from "./measure";
import { COLUMN_WIDTH, SIZE_BODY } from "./constants";
import { formatSkillLine } from "./skill-line";

export type LineBudgets = {
  summaryMaxLines: number;
  skillsMaxLines: number;
  bullets: Record<string, number>;
  projects: Record<string, number>;
};

const TAILOR_PROJECT_LINE_CAP = 4;
const TAILOR_SUMMARY_LINE_CAP = 6;

/** Tighter per-fact caps for tailoring (one-page PDF + mixed 1–2 line bullets). */
export function applyTailorLineBudgetCaps(budgets: LineBudgets, resume: MasterResume): LineBudgets {
  const bullets: Record<string, number> = {};
  for (const exp of resume.experience) {
    const dense = exp.facts.length >= 6;
    exp.facts.forEach((f, i) => {
      const natural = Math.min(budgets.bullets[f.id] ?? 2, 2);
      const staggered = dense ? (i % 3 === 0 ? 2 : 1) : natural;
      bullets[f.id] = Math.max(1, staggered);
    });
  }
  const projects: Record<string, number> = {};
  for (const [id, lines] of Object.entries(budgets.projects)) {
    projects[id] = Math.min(lines, TAILOR_PROJECT_LINE_CAP);
  }
  return {
    ...budgets,
    summaryMaxLines: Math.min(budgets.summaryMaxLines, TAILOR_SUMMARY_LINE_CAP),
    skillsMaxLines: budgets.skillsMaxLines,
    bullets,
    projects,
  };
}

export function computeLineBudgets(resume: MasterResume): LineBudgets {
  const defaultSummary = resume.summaryFacts.map((f) => f.text).join(" ");
  const summaryMaxLines = Math.min(
    SUMMARY_MAX_LINES,
    countWrappedLines(defaultSummary, COLUMN_WIDTH, SIZE_BODY),
  );

  const bullets: Record<string, number> = {};
  for (const exp of resume.experience) {
    for (const f of exp.facts) {
      bullets[f.id] = countBulletLines(f.text);
    }
  }

  const projects: Record<string, number> = {};
  for (const p of resume.projects) {
    const text = p.facts.map((f) => f.text).join(" ");
    projects[p.id] = countWrappedLines(text, COLUMN_WIDTH, SIZE_BODY);
  }

  const skillLines = countSkillBlockLines(resume);
  const skillsMaxLines = Math.min(SKILLS_MAX_LINES, skillLines);

  return {
    summaryMaxLines: summaryMaxLines || SUMMARY_MAX_LINES,
    skillsMaxLines: skillsMaxLines || SKILLS_MAX_LINES,
    bullets,
    projects,
  };
}

/** Lines used by the skills block (category label + wrapped skill line per non-empty category). */
export function countSkillLines(categories: { categoryId: string; names: string[] }[]): number {
  let lines = 0;
  for (const cat of categories) {
    if (!cat.names.length) continue;
    lines += 1; // category label
    lines += countWrappedLines(formatSkillLine(cat.categoryId, cat.names), COLUMN_WIDTH, SIZE_BODY);
  }
  return lines;
}

function countSkillBlockLines(resume: MasterResume): number {
  return countSkillLines(
    resume.skillCategories.map((cat) => ({
      categoryId: cat.id,
      names: resume.skills.filter((s) => s.categoryId === cat.id).map((s) => s.name),
    })),
  );
}

export function maxCharsForLines(maxLines: number, fontSize: number = SIZE_BODY): number {
  return maxLines * charsPerLineApprox(fontSize);
}

function charsPerLineApprox(fontSize: number): number {
  return Math.floor(COLUMN_WIDTH / (fontSize * 0.52));
}
