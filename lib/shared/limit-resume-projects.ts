import type { ResumeView } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { RESUME_MAX_PROJECTS } from "@/lib/resume/layout/constants";

/** Keep PDF/editor aligned with JD-selected projects (max 3). */
export function limitResumeViewProjects(
  view: ResumeView,
  analysis?: JobAnalysis | null,
): ResumeView {
  const ids = analysis?.selectedProjectIds?.filter((id) =>
    view.projects.some((p) => p.id === id),
  );
  if (ids?.length) {
    const byId = new Map(view.projects.map((p) => [p.id, p]));
    return {
      ...view,
      projects: ids
        .slice(0, RESUME_MAX_PROJECTS)
        .map((id) => byId.get(id))
        .filter(Boolean) as ResumeView["projects"],
    };
  }
  if (view.projects.length <= RESUME_MAX_PROJECTS) return view;
  return { ...view, projects: view.projects.slice(0, RESUME_MAX_PROJECTS) };
}
