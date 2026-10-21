import type { ResumeView } from "@/lib/schemas/resume";

export function estimatePageCount(resume: ResumeView, density: "normal" | "compact"): number {
  const chars =
    resume.summary.length +
    resume.experience.reduce((a, e) => a + e.bullets.reduce((b, x) => b + x.text.length, 0), 0) +
    resume.projects.reduce((a, p) => a + p.description.length, 0) +
    resume.skills.reduce((a, c) => a + c.items.length * 12, 0);
  const factor = density === "compact" ? 3200 : 2600;
  return Math.max(1, Math.ceil(chars / factor));
}
