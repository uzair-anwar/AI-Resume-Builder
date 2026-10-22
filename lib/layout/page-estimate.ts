import type { ResumeView } from "@/lib/schemas/resume";
import {
  PAGE_HEIGHT,
  COLUMN_WIDTH,
  SIZE_BODY,
  LINE_HEIGHT_BODY,
  BULLET_GAP_PT,
} from "./constants";
import { countBulletLines, countWrappedLines } from "./measure";
import { formatSkillLine } from "./skill-line";

/** Matches ResumeDocument column start (pt). */
const COLUMNS_TOP = 109.3;
const BOTTOM_MARGIN = 34;
const MAX_COLUMN_LINES = (PAGE_HEIGHT - COLUMNS_TOP - BOTTOM_MARGIN) / LINE_HEIGHT_BODY;

/** Section title + rule + gap ≈ 3 body line boxes. */
const SECTION_HEADER_LINES = 3;

export function estimateColumnLineCounts(resume: ResumeView): { left: number; right: number } {
  let left = 0;
  left += SECTION_HEADER_LINES + countWrappedLines(resume.summary, COLUMN_WIDTH, SIZE_BODY);
  left += SECTION_HEADER_LINES;
  for (const cat of resume.skills) {
    if (!cat.items.length) continue;
    left +=
      1 +
      countWrappedLines(
        formatSkillLine(cat.categoryId, cat.items.map((i) => i.name)),
        COLUMN_WIDTH,
        SIZE_BODY,
      );
  }
  left += SECTION_HEADER_LINES;
  for (let pi = 0; pi < resume.projects.length; pi++) {
    left += 1 + countWrappedLines(resume.projects[pi]!.description, COLUMN_WIDTH, SIZE_BODY);
    if (pi < resume.projects.length - 1) left += 0.35;
  }

  let right = SECTION_HEADER_LINES;
  for (let ei = 0; ei < resume.experience.length; ei++) {
    const exp = resume.experience[ei]!;
    right += 2.6;
    exp.bullets.forEach((b, bi) => {
      right += countBulletLines(b.text);
      if (bi > 0) right += BULLET_GAP_PT / LINE_HEIGHT_BODY;
    });
    if (ei < resume.experience.length - 1) right += 0.55;
  }
  right += SECTION_HEADER_LINES;
  right += resume.education.length * 2.1;

  return { left, right };
}

export function resumeExceedsOnePage(resume: ResumeView): boolean {
  const { left, right } = estimateColumnLineCounts(resume);
  return left > MAX_COLUMN_LINES || right > MAX_COLUMN_LINES;
}

export function maxColumnLineOverflow(resume: ResumeView): number {
  const { left, right } = estimateColumnLineCounts(resume);
  return Math.max(0, left - MAX_COLUMN_LINES, right - MAX_COLUMN_LINES);
}
