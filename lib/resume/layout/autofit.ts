import type { ResumeView } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
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

/** Remove one lowest-relevance bullet (keeps at least one bullet per role when possible). */
export function dropLowestRelevanceBullet(
  resume: ResumeView,
  analysis?: JobAnalysis | null,
): ResumeView | null {
  const refs = listBullets(resume, analysis);
  if (refs.length === 0) return null;

  const expCounts = resume.experience.map((e) => e.bullets.length);
  const sorted = [...refs].sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return b.expIndex - a.expIndex || b.bulletIndex - a.bulletIndex;
  });

  const pick = sorted.find((r) => expCounts[r.expIndex] > 1) ?? sorted[0];

  const experience = resume.experience.map((exp, ei) => {
    if (ei !== pick.expIndex) return exp;
    return {
      ...exp,
      bullets: exp.bullets.filter((_, bi) => bi !== pick.bulletIndex),
    };
  });

  return { ...resume, experience };
}

export async function autoFitToOnePage(
  resume: ResumeView,
  analysis: JobAnalysis | null | undefined,
  pageCountFor: (view: ResumeView) => Promise<number>,
  maxIterations = 24,
): Promise<ResumeView> {
  let current = resume;
  let pages = await pageCountFor(current);
  let i = 0;
  while (pages > 1 && i < maxIterations) {
    const next = dropLowestRelevanceBullet(current, analysis);
    if (!next) break;
    current = next;
    pages = await pageCountFor(current);
    i += 1;
  }
  return current;
}
