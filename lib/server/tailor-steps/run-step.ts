import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type {
  TailorStepId,
  TailorStepPartial,
  TailorStepPrevious,
  TailorStepResponse,
} from "@/lib/schemas/tailoring-steps";
import { analyzeJob } from "../analyze-job";
import { finalizeResumeHeadline } from "../headline-align";
import {
  EXPERIENCE_JSON_SCHEMA,
  HEADLINE_JSON_SCHEMA,
  PROJECT_JSON_SCHEMA,
  SKILLS_JSON_SCHEMA,
  SUMMARY_JSON_SCHEMA,
  experienceSystemPrompt,
  experienceUserPrompt,
  headlineSystemPrompt,
  headlineUserPrompt,
  projectSystemPrompt,
  projectUserPrompt,
  skillsSystemPrompt,
  skillsOrderUserPrompt,
  summarySystemPrompt,
  summaryUserPrompt,
} from "../prompts-staged";
import { detectRoleFamily } from "../role-families";
import { defaultSummaryText } from "../step-validation-helpers";
import {
  coerceExperienceStep,
  coerceHeadlineStep,
  coerceProjectStep,
  coerceSkillsStep,
  coerceSummaryStep,
} from "../step-coercion";
import {
  fallbackExperience,
  fallbackProject,
  validateExperienceStep,
  validateHeadlineStep,
  validateProjectStep,
  validateSkillsStep,
  validateSummaryStep,
} from "../step-validators";
import {
  buildSkillCandidateSet,
  deterministicSkillOrder,
} from "./build-skills";
import { runStructuredAiCall, type TailorAiOptions } from "./run-ai-structured";

export async function runTailorStep(
  step: TailorStepId,
  resume: MasterResume,
  jobText: string,
  ai: TailorAiOptions,
  previous: TailorStepPrevious = {},
): Promise<TailorStepResponse> {
  const analysis = analyzeJob(jobText, resume);
  const family = detectRoleFamily(jobText);
  const warnings: string[] = [];
  const partial: TailorStepPartial = {};

  if (step === "summary") {
    const fallback = defaultSummaryText(resume);
    const result = await runStructuredAiCall({
      ai,
      messages: [
        { role: "system", content: summarySystemPrompt() },
        { role: "user", content: summaryUserPrompt(jobText, resume, analysis, family) },
      ],
      jsonSchema: SUMMARY_JSON_SCHEMA,
      maxTokens: 600,
      validate: (raw) => validateSummaryStep(raw, resume, analysis),
    });
    if (result.ok) {
      partial.summary = result.data.summary;
      return { step, partial, warnings, aiUsage: result.aiUsage };
    }
    const coerced = coerceSummaryStep(result.lastRaw, resume, analysis);
    if (coerced) {
      partial.summary = coerced.summary;
      warnings.push("Summary adjusted to fit guardrails (still tailored).");
      return {
        step,
        partial,
        warnings,
        aiUsage: result.aiUsage,
        usedFallback: true,
      };
    }
    warnings.push("Kept original summary wording.");
    partial.summary = fallback;
    return { step, partial, warnings, usedFallback: true };
  }

  if (step === "experience") {
    const experience: TailorStepPartial["experience"] = [];
    let lastUsage = undefined;
    for (const exp of resume.experience) {
      const result = await runStructuredAiCall({
        ai,
        messages: [
          { role: "system", content: experienceSystemPrompt() },
          {
            role: "user",
            content: experienceUserPrompt(jobText, resume, analysis, exp.id, family),
          },
        ],
        jsonSchema: EXPERIENCE_JSON_SCHEMA,
        maxTokens: 900,
        validate: (raw) => validateExperienceStep(raw, resume, analysis, exp.id),
      });
      if (result.ok) {
        experience.push({ experienceId: exp.id, bullets: result.data.bullets });
        lastUsage = result.aiUsage;
      } else {
        const coerced = coerceExperienceStep(result.lastRaw, resume, analysis, exp.id);
        if (coerced) {
          experience.push({ experienceId: exp.id, bullets: coerced.bullets });
          warnings.push(`Experience at ${exp.company} adjusted to fit guardrails.`);
          lastUsage = result.aiUsage;
        } else {
          warnings.push(`Kept original bullets for ${exp.company}.`);
          experience.push(fallbackExperience(resume, exp.id));
        }
      }
    }
    partial.experience = experience;
    return { step, partial, warnings, aiUsage: lastUsage, usedFallback: warnings.length > 0 };
  }

  if (step === "skills") {
    const candidates = buildSkillCandidateSet(resume, analysis, family);
    const det = deterministicSkillOrder(resume, analysis, family);
    const result = await runStructuredAiCall({
      ai,
      messages: [
        { role: "system", content: skillsSystemPrompt() },
        {
          role: "user",
          content: skillsOrderUserPrompt(jobText, resume, candidates, analysis, family),
        },
      ],
      jsonSchema: SKILLS_JSON_SCHEMA,
      maxTokens: 800,
      validate: (raw) => validateSkillsStep(raw, resume, analysis, candidates, family),
    });
    if (result.ok) {
      partial.selectedSkillIds = result.data.selectedSkillIds;
      partial.skillCategoryOrder = result.data.skillCategoryOrder;
      return { step, partial, warnings, aiUsage: result.aiUsage };
    }
    const coerced = coerceSkillsStep(result.lastRaw, resume, analysis, candidates, family);
    if (coerced) {
      partial.selectedSkillIds = coerced.selectedSkillIds;
      partial.skillCategoryOrder = coerced.skillCategoryOrder;
      warnings.push("Skills reordered with guardrail fixes.");
      return { step, partial, warnings, aiUsage: result.aiUsage, usedFallback: true };
    }
    warnings.push("Used job-focused skill order (AI reorder unavailable).");
    partial.selectedSkillIds = det.selectedSkillIds;
    partial.skillCategoryOrder = det.skillCategoryOrder;
    return { step, partial, warnings, usedFallback: true };
  }

  if (step === "projects") {
    const projects: NonNullable<TailorStepPartial["projects"]> = [];
    let lastUsage = undefined;
    for (const proj of resume.projects) {
      const result = await runStructuredAiCall({
        ai,
        messages: [
          { role: "system", content: projectSystemPrompt() },
          {
            role: "user",
            content: projectUserPrompt(jobText, resume, proj.id, analysis, family),
          },
        ],
        jsonSchema: PROJECT_JSON_SCHEMA,
        maxTokens: 500,
        validate: (raw) => validateProjectStep(raw, resume, analysis, proj.id),
      });
      if (result.ok) {
        projects.push({
          projectId: proj.id,
          description: result.data.description,
          sourceFactIds: result.data.sourceFactIds,
        });
        lastUsage = result.aiUsage;
      } else {
        const coerced = coerceProjectStep(result.lastRaw, resume, analysis, proj.id);
        if (coerced) {
          projects.push({
            projectId: proj.id,
            description: coerced.description,
            sourceFactIds: coerced.sourceFactIds,
          });
          warnings.push(`Project ${proj.name} adjusted to fit guardrails.`);
          lastUsage = result.aiUsage;
        } else {
          warnings.push(`Kept original description for ${proj.name}.`);
          projects.push(fallbackProject(resume, proj.id));
        }
      }
    }
    partial.projects = projects;
    return { step, partial, warnings, aiUsage: lastUsage, usedFallback: warnings.length > 0 };
  }

  if (step === "headline") {
    const summary = previous.summary ?? defaultSummaryText(resume);
    const skillIds =
      previous.selectedSkillIds ?? deterministicSkillOrder(resume, analysis, family).selectedSkillIds;
    const skillNames = skillIds
      .map((id) => resume.skills.find((s) => s.id === id)?.name)
      .filter(Boolean) as string[];
    const fallback = family.headlinePattern || resume.person.defaultHeadline;
    const result = await runStructuredAiCall({
      ai,
      messages: [
        { role: "system", content: headlineSystemPrompt() },
        {
          role: "user",
          content: headlineUserPrompt(jobText, resume, family, summary, skillNames, analysis),
        },
      ],
      jsonSchema: HEADLINE_JSON_SCHEMA,
      maxTokens: 200,
      validate: (raw) => validateHeadlineStep(raw, resume, analysis),
    });
    if (result.ok) {
      partial.headline = result.data.headline;
      return { step, partial, warnings, aiUsage: result.aiUsage };
    }
    const coerced = coerceHeadlineStep(result.lastRaw, resume, analysis);
    if (coerced) {
      partial.headline = coerced.headline;
      warnings.push("Headline adjusted to fit guardrails.");
      return { step, partial, warnings, aiUsage: result.aiUsage, usedFallback: true };
    }
    partial.headline = finalizeResumeHeadline(fallback, analysis, resume, family);
    warnings.push("Used deterministic headline from JD role title.");
    return { step, partial, warnings, usedFallback: true };
  }

  return { step, partial, warnings: ["Unknown step"], usedFallback: true };
}

export function mergePrevious(
  prev: TailorStepPrevious,
  partial: TailorStepPartial,
): TailorStepPrevious {
  return {
    ...prev,
    ...partial,
    experience: partial.experience ?? prev.experience,
    projects: partial.projects ?? prev.projects,
  };
}

export function stagedToTailoringResult(
  state: TailorStepPrevious,
  resume: MasterResume,
): import("@/lib/schemas/tailoring").TailoringResult {
  return {
    headline: state.headline ?? resume.person.defaultHeadline,
    summary: state.summary ?? defaultSummaryText(resume),
    selectedSkillIds: state.selectedSkillIds ?? resume.skills.map((s) => s.id),
    skillCategoryOrder: state.skillCategoryOrder ?? resume.skillCategories.map((c) => c.id),
    experience:
      state.experience ??
      resume.experience.map((e) => ({
        experienceId: e.id,
        bullets: e.facts.map((f) => ({ text: f.text, sourceFactIds: [f.id] })),
      })),
    projects:
      state.projects ??
      resume.projects.map((p) => ({
        projectId: p.id,
        description: p.facts.map((f) => f.text).join(" "),
        sourceFactIds: p.facts.map((f) => f.id),
      })),
    requirementNotes: [],
    warnings: [],
  };
}
