import "server-only";
import { MasterResume, MasterResumeSchema } from "@/lib/schemas/resume";
import type { ProfileOverride } from "@/lib/schemas/profile";
import { ProfileOverrideSchema } from "@/lib/schemas/profile";
import { dedupeSkills } from "@/lib/skills/dedupe-skills";
import { loadMaster } from "./registry";

/** Back-compat: the default master resume. Prefer `loadMaster(masterId)` from ./registry. */
export function loadMasterResume(masterId?: string | null): MasterResume {
  return loadMaster(masterId);
}

export function mergeProfileOverride(
  base: MasterResume,
  override?: ProfileOverride | null,
): MasterResume {
  if (!override) return base;
  const parsed = ProfileOverrideSchema.safeParse(override);
  if (!parsed.success) return base;

  const merged: MasterResume = {
    ...base,
    ...parsed.data,
    person: {
      ...base.person,
      ...parsed.data.person,
      location: parsed.data.person?.location?.trim() || base.person.location,
      phone: parsed.data.person?.phone?.trim() || base.person.phone,
    },
    skills: [...base.skills],
    experience: (parsed.data.experience ?? base.experience).map((exp) => {
      const fromBase = base.experience.find((e) => e.id === exp.id);
      return { ...exp, location: exp.location?.trim() || fromBase?.location || "" };
    }),
    projects: parsed.data.projects ?? base.projects,
    education: parsed.data.education ?? base.education,
  };

  if (parsed.data.attestedSkills?.length) {
    for (const s of parsed.data.attestedSkills) {
      if (!merged.skills.some((x) => x.id === s.id)) {
        merged.skills.push({
          id: s.id,
          name: s.name,
          categoryId: s.categoryId,
          aliases: [],
          userAttested: true,
          level: s.level,
        });
      }
    }
  }

  const out = MasterResumeSchema.parse(merged);
  return out.allowDuplicateSkills ? out : dedupeSkills(out);
}

export function getAllFactIds(resume: MasterResume): Set<string> {
  const ids = new Set<string>();
  for (const e of resume.experience) {
    for (const f of e.facts) ids.add(f.id);
  }
  for (const p of resume.projects) {
    for (const f of p.facts) ids.add(f.id);
  }
  for (const f of resume.summaryFacts) ids.add(f.id);
  return ids;
}

export function getFactById(resume: MasterResume, factId: string): string | undefined {
  for (const e of resume.experience) {
    const f = e.facts.find((x) => x.id === factId);
    if (f) return f.text;
  }
  for (const p of resume.projects) {
    const f = p.facts.find((x) => x.id === factId);
    if (f) return f.text;
  }
  const s = resume.summaryFacts.find((x) => x.id === factId);
  return s?.text;
}
