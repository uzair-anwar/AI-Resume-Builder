import { z } from "zod";
import { ResumeViewSchema } from "./resume";

export const TailoringResultSchema = z.object({
  headline: z.string().min(1).max(400),
  summary: z.string().min(1).max(4000),
  selectedSkillIds: z.array(z.string()),
  skillCategoryOrder: z.array(z.string()),
  experience: z.array(
    z.object({
      experienceId: z.string(),
      bullets: z.array(
        z.object({
          text: z.string().min(1).max(1500),
          sourceFactIds: z.array(z.string()).min(1),
        }),
      ),
    }),
  ),
  projects: z.array(
    z.object({
      projectId: z.string(),
      description: z.string().min(1).max(3000),
      sourceFactIds: z.array(z.string()).min(1),
    }),
  ),
  requirementNotes: z.array(
    z.object({
      requirement: z.string(),
      status: z.enum(["matched", "transferable", "missing"]),
      evidenceFactIds: z.array(z.string()),
    }),
  ),
  warnings: z.array(z.string()),
});

export type TailoringResult = z.infer<typeof TailoringResultSchema>;

export const JdTermChipSchema = z.object({
  term: z.string(),
  status: z.enum(["matched", "related", "missing"]),
  relatedVia: z.string().optional(),
});

export const LineBudgetsSchema = z.object({
  summaryMaxLines: z.number(),
  skillsMaxLines: z.number(),
  bullets: z.record(z.string(), z.number()),
  projects: z.record(z.string(), z.number()),
});

export const JobAnalysisSchema = z.object({
  detectedTitle: z.string().optional(),
  focusLabel: z.string(),
  terms: z.array(JdTermChipSchema),
  coverage: z.object({
    matched: z.number(),
    related: z.number(),
    missing: z.number(),
    total: z.number(),
  }),
  lineBudgets: LineBudgetsSchema,
  profileVocabulary: z.array(z.string()).optional(),
  missingTerms: z.array(z.string()).optional(),
});

export type JobAnalysis = z.infer<typeof JobAnalysisSchema>;

export const AiUsageSchema = z.object({
  provider: z.enum(["groq", "openrouter", "gemini", "cloudflare"]),
  providerLabel: z.string(),
  model: z.string(),
  usedProviderFallback: z.boolean().optional(),
});

export const TailorResponseSchema = z.object({
  resume: ResumeViewSchema,
  analysis: JobAnalysisSchema,
  changes: z.array(
    z.object({
      factId: z.string(),
      original: z.string(),
      tailored: z.string(),
    }),
  ),
  warnings: z.array(z.string()),
  usedFallback: z.boolean().optional(),
  aiUsage: AiUsageSchema.optional(),
});

export type TailorResponse = z.infer<typeof TailorResponseSchema>;
