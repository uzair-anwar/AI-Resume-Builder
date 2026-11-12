import { columnWidth, bodySize } from "./active";
import type { ResumeView } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { SUMMARY_MAX_LINES } from "./constants";
import { tailorCaps } from "./profile";
import { resumeOverflowPt } from "./page-estimate";

/** Baselines snap to a 0.75pt grid, so up to one grid step of overflow still prints on the page. */
const OVERFLOW_TOLERANCE_PT = 0.75;
const resumeExceedsOnePage = (resume: ResumeView) => resumeOverflowPt(resume) > OVERFLOW_TOLERANCE_PT;
import { fitToMaxBulletLines, fitToMaxWrappedLines } from "./text-fit";
import { scoreFactRelevance } from "@/lib/shared/relevance";

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

/** Drops the last (weakest) skill of the fullest category, keeping at least one per category. */
function dropWeakestSkill(resume: ResumeView): ResumeView | null {
  let best = -1;
  resume.skills.forEach((c, i) => {
    if (c.items.length > 1 && (best < 0 || c.items.length > resume.skills[best]!.items.length)) best = i;
  });
  if (best < 0) return null;
  return {
    ...resume,
    skills: resume.skills.map((c, i) => (i === best ? { ...c, items: c.items.slice(0, -1) } : c)),
  };
}

/**
 * One step towards fitting the page: drop the least relevant bullet, or — when the overflowing
 * column does not contain experience (e.g. a long skills column) — the weakest skill.
 * Returns null when no step reduces the overflow.
 */
function dropToFit(resume: ResumeView, analysis?: JobAnalysis | null): ResumeView | null {
  const before = resumeOverflowPt(resume);
  const bullet = dropLowestBullet(resume, analysis);
  if (bullet && resumeOverflowPt(bullet) < before - 0.01) return bullet;
  // Skills may need several removals before a line disappears.
  let skills = dropWeakestSkill(resume);
  for (let i = 0; skills && i < 6; i++) {
    if (resumeOverflowPt(skills) < before - 0.01) return skills;
    skills = dropWeakestSkill(skills);
  }
  return null;
}

function trimToLineCaps(
  resume: ResumeView,
  bulletMax: number,
  projectMax: number,
  summaryMax: number,
): ResumeView {
  return {
    ...resume,
    summary: fitToMaxWrappedLines(resume.summary, summaryMax, columnWidth(), bodySize()),
    experience: resume.experience.map((exp) => ({
      ...exp,
      bullets: exp.bullets.map((b) => ({
        ...b,
        text: fitToMaxBulletLines(b.text, bulletMax),
      })),
    })),
    projects: resume.projects.map((p) => ({
      ...p,
      description: fitToMaxWrappedLines(p.description, projectMax, columnWidth(), bodySize()),
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
    const dropped = dropToFit(current, analysis);
    if (dropped) {
      current = dropped;
      continue;
    }
    break;
  }

  if (!resumeExceedsOnePage(current)) return current;

  const caps = tailorCaps();
  const TAILOR_BULLET_MAX_LINES = caps.bulletMax;
  const TAILOR_BULLET_MIN_LINES = caps.bulletMin;
  const TAILOR_PROJECT_MAX_LINES = caps.projectMax;
  const TAILOR_SUMMARY_MAX_LINES = caps.summaryMax;
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
    const dropped = dropToFit(current, analysis);
    if (!dropped) break;
    current = dropped;
  }

  return current;
}
