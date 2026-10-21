import type { MasterResume } from "@/lib/schemas/resume";
import { SUMMARY_MAX_LINES, SKILLS_MAX_LINES } from "./constants";
import { countBulletLines, countWrappedLines } from "./measure";
import { COLUMN_WIDTH, SIZE_BODY } from "./constants";

export type LineBudgets = {
  summaryMaxLines: number;
  skillsMaxLines: number;
  bullets: Record<string, number>;
  projects: Record<string, number>;
};

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

function countSkillBlockLines(resume: MasterResume): number {
  let lines = 0;
  for (const cat of resume.skillCategories) {
    const items = resume.skills.filter((s) => s.categoryId === cat.id);
    if (!items.length) continue;
    lines += 1; // category label
    const line = items.map((s) => s.name).join(" | ");
    lines += countWrappedLines(line, COLUMN_WIDTH, SIZE_BODY);
  }
  return lines;
}

export function maxCharsForLines(maxLines: number, fontSize: number = SIZE_BODY): number {
  return maxLines * charsPerLineApprox(fontSize);
}

function charsPerLineApprox(fontSize: number): number {
  return Math.floor(COLUMN_WIDTH / (fontSize * 0.52));
}
