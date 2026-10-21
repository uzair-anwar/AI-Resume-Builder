import type { MasterResume } from "@/lib/schemas/resume";

function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9+#.]/g, "");
}

/**
 * Removes skills that appear twice under different categories/ids (e.g. "Python" listed as both a
 * language and a framework). The first occurrence wins, so the primary category keeps the skill.
 * Fact `skills` reference skills by name, so nothing else needs rewriting.
 */
export function dedupeSkills<T extends Pick<MasterResume, "skills">>(resume: T): T {
  const seen = new Set<string>();
  const skills = resume.skills.filter((s) => {
    const key = nameKey(s.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (skills.length === resume.skills.length) return resume;
  return { ...resume, skills };
}
