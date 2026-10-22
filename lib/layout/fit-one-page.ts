import type { ResumeView } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { SUMMARY_MAX_LINES, SIZE_BODY, COLUMN_WIDTH } from "./constants";
import { countBulletLines, countWrappedLines } from "./measure";
import { resumeExceedsOnePage } from "./page-estimate";
import { fitToMaxBulletLines, fitToMaxWrappedLines } from "./text-fit";
import { scoreFactRelevance } from "@/lib/relevance";

type BulletRef = { expIndex: number; bulletIndex: number; score: number };

function listBullets(resume: ResumeView, analysis?: JobAnalysis | null): BulletRef[] {
  const out: BulletRef[] = [];
  resume.experience.forEach((exp, expIndex) => {
    exp.bullets.forEach((b, bulletIndex) => {
      out.push({
        expIndex,
        bulletIndex,
        score: scoreFactRelevance(b.text, analysis),
      });
    });
  });
  return out;
}

function dropLowestBullet(resume: ResumeView, analysis?: JobAnalysis | null): ResumeView | null {
  const refs = listBullets(resume, analysis);
  if (!refs.length) return null;
  const expCounts = resume.experience.map((e) => e.bullets.length);
  const sorted = [...refs].sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return b.expIndex - a.expIndex || b.bulletIndex - a.bulletIndex;
  });
  const pick = sorted.find((r) => expCounts[r.expIndex] > 1) ?? sorted[0];
  const experience = resume.experience.map((exp, ei) => {
    if (ei !== pick.expIndex) return exp;
    return { ...exp, bullets: exp.bullets.filter((_, bi) => bi !== pick.bulletIndex) };
  });
  return { ...resume, experience };
}

function tightenCopy(resume: ResumeView): ResumeView {
  const summary = fitToMaxWrappedLines(
    resume.summary,
    Math.min(SUMMARY_MAX_LINES, 6),
    COLUMN_WIDTH,
    SIZE_BODY,
  );
  const experience = resume.experience.map((exp) => ({
    ...exp,
    bullets: exp.bullets.map((b, i) => {
      const maxLines = i % 3 === 0 ? 2 : 1;
      return { ...b, text: fitToMaxBulletLines(b.text, maxLines) };
    }),
  }));
  const projects = resume.projects.map((p) => ({
    ...p,
    description: fitToMaxWrappedLines(p.description, 4, COLUMN_WIDTH, SIZE_BODY),
  }));
  return { ...resume, summary, experience, projects };
}

/**
 * Deterministic one-page fit: shorten text first, then drop lowest-JD-relevance bullets.
 * Uses the same line metrics as the PDF template (no browser PDF render).
 */
export function fitResumeViewToOnePage(
  resume: ResumeView,
  analysis?: JobAnalysis | null,
  maxIterations = 40,
): ResumeView {
  let current = tightenCopy(resume);
  let guard = 0;
  while (resumeExceedsOnePage(current) && guard++ < maxIterations) {
    const shorter = tightenCopy(current);
    if (!resumeExceedsOnePage(shorter)) return shorter;
    if (JSON.stringify(shorter) !== JSON.stringify(current)) {
      current = shorter;
      continue;
    }
    const dropped = dropLowestBullet(current, analysis);
    if (!dropped) break;
    current = tightenCopy(dropped);
  }
  return current;
}
