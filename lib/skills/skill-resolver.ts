import type { MasterResume } from "@/lib/schemas/resume";

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Maps whatever id/name the model produced onto a real skill id. */
export function buildSkillResolver(resume: MasterResume) {
  const byId = new Map(resume.skills.map((s) => [s.id, s.id]));
  const byNorm = new Map<string, string>();
  for (const s of resume.skills) {
    const idKey = norm(s.id.replace(/^skill[-_]?/, ""));
    if (!byNorm.has(idKey)) byNorm.set(idKey, s.id);
    const nameKey = norm(s.name);
    if (!byNorm.has(nameKey)) byNorm.set(nameKey, s.id);
    for (const a of s.aliases ?? []) {
      const k = norm(a);
      if (k && !byNorm.has(k)) byNorm.set(k, s.id);
    }
  }
  return (raw: string): string | undefined => {
    if (byId.has(raw)) return raw;
    return byNorm.get(norm(raw.replace(/^skill[-_]?/i, ""))) ?? byNorm.get(norm(raw));
  };
}
