import type { ResumeView } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import {
  TAILOR_BULLET_MAX_LINES,
  TAILOR_BULLET_MIN_LINES,
  TAILOR_PROJECT_MAX_LINES,
  TAILOR_SUMMARY_MAX_LINES,
  SUMMARY_MAX_LINES,
  SIZE_BODY,
  COLUMN_WIDTH,
} from "./constants";
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

function trimToLineCaps(
  resume: ResumeView,
  bulletMax: number,
  projectMax: number,
  summaryMax: number,
): ResumeView {
  return {
    ...resume,
    summary: fitToMaxWrappedLines(resume.summary, summaryMax, COLUMN_WIDTH, SIZE_BODY),
    experience: resume.experience.map((exp) => ({
      ...exp,
      bullets: exp.bullets.map((b) => ({
        ...b,
        text: fitToMaxBulletLines(b.text, bulletMax),
      })),
    })),
    projects: resume.projects.map((p) => ({
      ...p,
      description: fitToMaxWrappedLines(p.description, projectMax, COLUMN_WIDTH, SIZE_BODY),
    })),
  };
}

/**
 * Keep rich 2–3 line bullets when possible. Drop low-relevance bullets only when the
 * template estimate overflows; trim line caps only as a last resort.
 */
export function fitResumeViewToOnePage(
  resume: ResumeView,
  analysis?: JobAnalysis | null,
  maxIterations = 28,
): ResumeView {
  let current = resume;
  let guard = 0;

  while (resumeExceedsOnePage(current) && guard++ < maxIterations) {
    const dropped = dropLowestBullet(current, analysis);
    if (dropped) {
      current = dropped;
      continue;
    }
    break;
  }

  if (!resumeExceedsOnePage(current)) return current;

  const trimSteps = [
    {
      bullet: TAILOR_BULLET_MAX_LINES,
      project: TAILOR_PROJECT_MAX_LINES,
      summary: Math.min(SUMMARY_MAX_LINES, TAILOR_SUMMARY_MAX_LINES),
    },
    {
      bullet: TAILOR_BULLET_MIN_LINES + 1,
      project: TAILOR_PROJECT_MAX_LINES - 1,
      summary: TAILOR_SUMMARY_MAX_LINES - 1,
    },
    {
      bullet: TAILOR_BULLET_MIN_LINES,
      project: TAILOR_PROJECT_MAX_LINES - 2,
      summary: TAILOR_SUMMARY_MAX_LINES - 2,
    },
  ];

  for (const step of trimSteps) {
    current = trimToLineCaps(current, step.bullet, step.project, step.summary);
    if (!resumeExceedsOnePage(current)) return current;
  }

  guard = 0;
  while (resumeExceedsOnePage(current) && guard++ < 8) {
    const dropped = dropLowestBullet(current, analysis);
    if (!dropped) break;
    current = dropped;
  }

  return current;
}
