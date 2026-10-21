import { z } from "zod";
import { AiUsageSchema } from "./tailoring";

export const TAILOR_STEP_IDS = [
  "summary",
  "experience",
  "skills",
  "projects",
  "headline",
] as const;

export type TailorStepId = (typeof TAILOR_STEP_IDS)[number];

export const ExperienceBulletSchema = z.object({
  text: z.string().min(1).max(1500),
  sourceFactIds: z.array(z.string()).min(1),
});

export const ExperienceStepItemSchema = z.object({
  experienceId: z.string(),
  bullets: z.array(ExperienceBulletSchema),
});

export const ProjectStepItemSchema = z.object({
  projectId: z.string(),
  description: z.string().min(1).max(3000),
  sourceFactIds: z.array(z.string()).min(1),
});

export const TailorStepPreviousSchema = z.object({
  summary: z.string().optional(),
  experience: z.array(ExperienceStepItemSchema).optional(),
  selectedSkillIds: z.array(z.string()).optional(),
  skillCategoryOrder: z.array(z.string()).optional(),
  projects: z.array(ProjectStepItemSchema).optional(),
  headline: z.string().optional(),
});

export type TailorStepPrevious = z.infer<typeof TailorStepPreviousSchema>;

export const TailorStepRequestSchema = z.object({
  step: z.enum(TAILOR_STEP_IDS),
  jobDescription: z.string().min(50).max(20000),
  provider: z.enum(["auto", "groq", "openrouter", "gemini", "cloudflare"]).optional(),
  providerModels: z
    .record(
      z.enum(["groq", "openrouter", "gemini", "cloudflare"]),
      z.string().max(200),
    )
    .optional(),
  allowProviderFallback: z.boolean().optional(),
  previous: TailorStepPreviousSchema.optional(),
  profileOverride: z.record(z.string(), z.unknown()).optional(),
});

export type TailorStepRequest = z.infer<typeof TailorStepRequestSchema>;

export const TailorStepPartialSchema = z.object({
  summary: z.string().optional(),
  experience: z.array(ExperienceStepItemSchema).optional(),
  selectedSkillIds: z.array(z.string()).optional(),
  skillCategoryOrder: z.array(z.string()).optional(),
  projects: z.array(ProjectStepItemSchema).optional(),
  headline: z.string().optional(),
});

export type TailorStepPartial = z.infer<typeof TailorStepPartialSchema>;

export const TailorStepResponseSchema = z.object({
  step: z.enum(TAILOR_STEP_IDS),
  partial: TailorStepPartialSchema,
  warnings: z.array(z.string()),
  aiUsage: AiUsageSchema.optional(),
  usedFallback: z.boolean().optional(),
});

export type TailorStepResponse = z.infer<typeof TailorStepResponseSchema>;

export type StagedTailorState = TailorStepPrevious;
