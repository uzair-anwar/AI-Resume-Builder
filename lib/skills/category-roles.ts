import type { MasterResume } from "@/lib/schemas/resume";

type Category = MasterResume["skillCategories"][number];

/** Roles that can stand in for one another when a master has no category of the exact role. */
const ROLE_ALIASES: Record<string, string[]> = {
  frameworks: ["frameworks", "backend", "frontend", "ruby", "ui"],
  architecture: ["architecture", "backend"],
  ai: ["ai", "llm", "ml"],
  api: ["api", "backend"],
  vcs: ["vcs", "devops"],
  languages: ["languages"],
  databases: ["databases"],
  cloud: ["cloud"],
  devops: ["devops", "cloud"],
};

/** Semantic role of a category: its `role`, else the legacy `cat-<role>` id. */
export function categoryRole(cat: Pick<Category, "id" | "role">): string {
  return cat.role ?? cat.id.replace(/^cat-/, "");
}

/** Category ids of a master matching a role (or legacy `cat-<role>` id), best match first. */
export function categoryIdsForRole(resume: MasterResume, roleOrId: string): string[] {
  const role = roleOrId.replace(/^cat-/, "");
  const wanted = ROLE_ALIASES[role] ?? [role];
  const out: string[] = [];
  for (const w of wanted) {
    for (const c of resume.skillCategories) {
      if (categoryRole(c) === w && !out.includes(c.id)) out.push(c.id);
    }
  }
  return out;
}

/** First category id for a role, else the fallback role, else the last category of the master. */
export function pickCategoryId(resume: MasterResume, role: string, ...fallbackRoles: string[]): string {
  for (const r of [role, ...fallbackRoles]) {
    const id = categoryIdsForRole(resume, r)[0];
    if (id) return id;
  }
  return resume.skillCategories[resume.skillCategories.length - 1]?.id ?? "cat-languages";
}

/** True when the skill's category plays any of the given roles (e.g. languages, frameworks, cloud). */
export function skillHasRole(resume: MasterResume, categoryId: string, roles: string[]): boolean {
  const cat = resume.skillCategories.find((c) => c.id === categoryId);
  if (!cat) return false;
  const role = categoryRole(cat);
  return roles.some((r) => (ROLE_ALIASES[r] ?? [r]).includes(role));
}
