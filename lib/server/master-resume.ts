import "server-only";
import { readFileSync } from "fs";
import path from "path";
import { MasterResume, MasterResumeSchema } from "@/lib/schemas/resume";
import type { ProfileOverride } from "@/lib/schemas/profile";
import { ProfileOverrideSchema } from "@/lib/schemas/profile";

let cached: MasterResume | null = null;

export function loadMasterResume(): MasterResume {
  if (cached) return cached;
  const file = path.join(process.cwd(), "data", "master-resume.json");
  const raw = JSON.parse(readFileSync(file, "utf8"));
  cached = MasterResumeSchema.parse(raw);
  return cached;
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
    person: { ...base.person, ...parsed.data.person },
    skills: [...base.skills],
    experience: parsed.data.experience ?? base.experience,
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

  return MasterResumeSchema.parse(merged);
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
