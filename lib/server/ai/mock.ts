import "server-only";
import type { AiProvider } from "./provider";

export const mockProvider: AiProvider = {
  async completeStructured() {
    const raw = {
      headline: "Senior Software Engineer (Full Stack)",
      summary:
        "Building AI-powered platforms, financial systems, and cloud-native applications across healthcare, fintech, mortgage, and SaaS. Experienced with React, Next.js, Node.js, Python, and AWS serverless technologies, with a focus on scalable architectures and business-critical workflows.",
      selectedSkillIds: [
        "skill-typescript",
        "skill-react",
        "skill-nextjs",
        "skill-node",
        "skill-python",
        "skill-aws",
        "skill-rest",
        "skill-postgres",
        "skill-mongo",
      ],
      skillCategoryOrder: [
        "cat-languages",
        "cat-frameworks",
        "cat-api",
        "cat-databases",
        "cat-cloud",
        "cat-architecture",
        "cat-devops",
        "cat-ai",
        "cat-vcs",
      ],
      experience: [
        {
          experienceId: "exp-micro1",
          bullets: [
            {
              text: "Built AI-assisted mortgage workflows using AWS serverless technologies.",
              sourceFactIds: ["fact-m1-1"],
            },
            {
              text: "Built backend services with Node.js and Python for workflow automation.",
              sourceFactIds: ["fact-m1-6"],
            },
          ],
        },
        {
          experienceId: "exp-devsorb",
          bullets: [
            {
              text: "Designed Node.js APIs powering reporting and business workflows.",
              sourceFactIds: ["fact-ds-3"],
            },
          ],
        },
        {
          experienceId: "exp-devsinc",
          bullets: [
            {
              text: "Created REST APIs supporting reporting and workflow automation.",
              sourceFactIds: ["fact-di-3"],
            },
          ],
        },
      ],
      projects: [
        {
          projectId: "proj-monte",
          description:
            "Financial analytics platform providing business intelligence, reporting, and operational visibility with interactive dashboards and analytics workflows.",
          sourceFactIds: ["fact-pm-1", "fact-pm-2"],
        },
      ],
      requirementNotes: [],
      warnings: ["Mock AI provider in use"],
    };
    return { raw };
  },
};
