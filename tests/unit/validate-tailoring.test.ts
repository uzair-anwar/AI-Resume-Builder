import { describe, it, expect } from "vitest";
import { loadMasterResume } from "@/lib/server/master-resume";
import { validateTailoring } from "@/lib/server/validate-tailoring";
import { analyzeJob } from "@/lib/server/analyze-job";
import { mockProvider } from "@/lib/server/ai/mock";

describe("validateTailoring", () => {
  const resume = loadMasterResume();
  const analysis = analyzeJob("Senior Java Spring Boot developer required", resume);

  it("accepts valid mock output", async () => {
    const { raw } = await mockProvider.completeStructured({
      messages: [],
      model: "mock",
      jsonSchema: {},
    });
    const result = validateTailoring(raw, resume, analysis);
    expect(result.ok).toBe(true);
  });

  it("rejects invented Java in bullets", () => {
    const bad = {
      headline: "Java Engineer",
      summary: "Java expert with Spring.",
      selectedSkillIds: ["skill-java"],
      skillCategoryOrder: ["cat-languages"],
      experience: [
        {
          experienceId: "exp-micro1",
          bullets: [{ text: "Built Java microservices with Spring Boot.", sourceFactIds: ["fact-m1-1"] }],
        },
      ],
      projects: [],
      requirementNotes: [],
      warnings: [],
    };
    const result = validateTailoring(bad, resume, analysis);
    expect(result.ok).toBe(false);
  });

  it("rejects unknown fact ids", () => {
    const bad = {
      headline: "Engineer",
      summary: "Summary text here.",
      selectedSkillIds: ["skill-typescript"],
      skillCategoryOrder: ["cat-languages"],
      experience: [
        {
          experienceId: "exp-micro1",
          bullets: [{ text: "Did something.", sourceFactIds: ["fact-unknown"] }],
        },
      ],
      projects: [],
      requirementNotes: [],
      warnings: [],
    };
    const result = validateTailoring(bad, resume, analysis);
    expect(result.ok).toBe(false);
  });
});
