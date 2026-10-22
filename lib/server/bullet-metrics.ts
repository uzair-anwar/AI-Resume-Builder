import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { TailoringResult } from "@/lib/schemas/tailoring";
import { getFactById } from "./master-resume";
import { extractNumbers } from "./step-validation-helpers";

/** Résumé scanners treat digits and common count patterns as measurable. */
export function bulletHasMeasurable(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/\b\d/.test(t)) return true;
  return /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(engineers?|developers?|apis?|dashboards?|services?|endpoints?|stores?)\b/i.test(
    t,
  );
}

/** Pull short metric phrases from verified fact text (never invent digits). */
export function metricPhrasesFromFact(factText: string): string[] {
  const phrases: string[] = [];
  const patterns = [
    /\d+\+?\s*(?:AWS|Encompass|REST|Node\.js)?\s*[\w-]*(?:API\s+endpoints?|serverless\s+services?|engineers?|dashboards?|data\s+stores?)/gi,
    /\b\d+\+?\s*[\w./-]+(?:\s+[\w./-]+){0,5}/g,
    /\b(?:mentored|led|managed|supported)\s+\d+\+?\s*[\w\s]{0,24}/gi,
    /\b\d+\s*data\s+stores?\b/gi,
    /\bacross\s+\d+\+?\s*[\w\s]{2,30}/gi,
  ];
  for (const re of patterns) {
    for (const m of factText.match(re) ?? []) {
      const p = m.trim().replace(/\s+/g, " ");
      if (p.length >= 3 && !phrases.some((x) => x.toLowerCase() === p.toLowerCase())) {
        phrases.push(p);
      }
    }
  }
  for (const n of extractNumbers(factText)) {
    if (!phrases.some((p) => p.includes(n))) {
      const idx = factText.indexOf(n);
      if (idx >= 0) {
        const slice = factText.slice(Math.max(0, idx - 12), idx + n.length + 28).trim();
        phrases.push(slice.replace(/^[^0-9]*/, "").trim() || n);
      }
    }
  }
  return phrases.sort((a, b) => b.length - a.length);
}

function phraseInBullet(bullet: string, phrase: string): boolean {
  const b = bullet.toLowerCase();
  const p = phrase.toLowerCase();
  if (b.includes(p)) return true;
  for (const n of extractNumbers(phrase)) {
    if (b.includes(n)) return true;
  }
  return false;
}

/** If the model dropped verified numbers, weave the best phrase from source fact(s). */
export function injectMetricsFromSources(bullet: string, sourceTexts: string[]): string {
  if (bulletHasMeasurable(bullet)) return bullet;
  const phrases = sourceTexts.flatMap(metricPhrasesFromFact);
  const pick = phrases.find((p) => !phraseInBullet(bullet, p));
  if (!pick) return bullet;

  const trimmed = bullet.trim();
  const m = trimmed.match(/^([A-Z][a-z]+ed)\b/);
  if (m) {
    const rest = trimmed.slice(m[0].length).trim();
    const lead = pick.replace(/^[,.]\s*/, "");
    return `${m[1]} ${lead.charAt(0).toLowerCase() + lead.slice(1)}${rest ? `, ${rest.charAt(0).toLowerCase() + rest.slice(1)}` : "."}`;
  }
  return `${trimmed.replace(/\.$/, "")}, ${pick.charAt(0).toLowerCase() + pick.slice(1)}.`;
}

const VERB_ALTERNATES: Record<string, string[]> = {
  built: ["Engineered", "Architected", "Delivered"],
  developed: ["Implemented", "Shipped", "Produced"],
  created: ["Designed", "Established", "Launched"],
  designed: ["Architected", "Modeled", "Structured"],
  integrated: ["Connected", "Unified", "Orchestrated"],
  improved: ["Enhanced", "Strengthened", "Optimized"],
  contributed: ["Drove", "Supported", "Advanced"],
  collaborated: ["Partnered", "Coordinated", "Aligned"],
  mentored: ["Coached", "Guided", "Upskilled"],
  led: ["Spearheaded", "Directed", "Headed"],
  worked: ["Partnered", "Collaborated", "Operated"],
};

function openingVerb(text: string): string | null {
  const m = text.trim().match(/^([A-Za-z]+)\b/);
  return m?.[1]?.toLowerCase() ?? null;
}

/** Avoid repeating the same opening verb within one employer block. */
export function diversifyBulletOpenings(bullets: string[]): string[] {
  const used = new Map<string, number>();
  return bullets.map((text) => {
    const verb = openingVerb(text);
    if (!verb) return text;
    const count = used.get(verb) ?? 0;
    used.set(verb, count + 1);
    if (count === 0) return text;
    const alts = VERB_ALTERNATES[verb];
    if (!alts?.length) return text;
    const alt = alts[(count - 1) % alts.length];
    return text.replace(/^([A-Za-z]+)\b/, alt);
  });
}

function roleMetricTarget(factTexts: string[]): number {
  const withMetric = factTexts.filter((t) => bulletHasMeasurable(t) || metricPhrasesFromFact(t).length).length;
  if (!withMetric) return 0;
  return Math.max(1, Math.ceil(factTexts.length / 2));
}

export function enforceExperienceBulletQuality(
  data: TailoringResult,
  resume: MasterResume,
): TailoringResult {
  const experience = data.experience.map((exp) => {
    const src = resume.experience.find((e) => e.id === exp.experienceId);
    if (!src) return exp;

    let bullets = exp.bullets.map((b) => {
      const sources = b.sourceFactIds
        .map((id) => getFactById(resume, id))
        .filter(Boolean) as string[];
      return {
        ...b,
        text: injectMetricsFromSources(b.text, sources.length ? sources : [b.text]),
      };
    });

    const target = roleMetricTarget(src.facts.map((f) => f.text));
    if (target > 0) {
      let withMetric = bullets.filter((b) => bulletHasMeasurable(b.text)).length;
      for (const b of bullets) {
        if (withMetric >= target) break;
        if (bulletHasMeasurable(b.text)) continue;
        const sources = b.sourceFactIds.map((id) => getFactById(resume, id) ?? "");
        const enriched = injectMetricsFromSources(b.text, sources);
        if (enriched !== b.text) {
          b.text = enriched;
          withMetric++;
        }
      }
      for (const f of src.facts) {
        if (withMetric >= target) break;
        if (!bulletHasMeasurable(f.text) && !metricPhrasesFromFact(f.text).length) continue;
        const covered = bullets.some(
          (b) => b.sourceFactIds.includes(f.id) && bulletHasMeasurable(b.text),
        );
        if (covered) continue;
        const existing = bullets.find((b) => b.sourceFactIds.includes(f.id));
        if (existing) {
          existing.text = injectMetricsFromSources(existing.text, [f.text]);
          if (bulletHasMeasurable(existing.text)) withMetric++;
        }
      }
    }

    const texts = diversifyBulletOpenings(bullets.map((b) => b.text));
    bullets = bullets.map((b, i) => ({ ...b, text: texts[i]! }));

    return { ...exp, bullets };
  });

  return { ...data, experience };
}

export function countResumeBulletsWithMetrics(view: {
  experience: { bullets: { text: string }[] }[];
}): { total: number; withMetric: number } {
  let total = 0;
  let withMetric = 0;
  for (const exp of view.experience) {
    for (const b of exp.bullets) {
      total++;
      if (bulletHasMeasurable(b.text)) withMetric++;
    }
  }
  return { total, withMetric };
}
