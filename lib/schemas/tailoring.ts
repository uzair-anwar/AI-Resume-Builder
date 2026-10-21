import { z } from "zod";
import { ResumeViewSchema } from "./resume";

export const TailoringResultSchema = z.object({
  headline: z.string().min(1).max(120),
  summary: z.string().min(1).max(1200),
  selectedSkillIds: z.array(z.string()),
  skillCategoryOrder: z.array(z.string()),
  experience: z.array(
    z.object({
      experienceId: z.string(),
      bullets: z.array(
        z.object({
          text: z.string().min(1).max(500),
          sourceFactIds: z.array(z.string()).min(1),
        }),
      ),
    }),
  ),
  projects: z.array(
    z.object({
      projectId: z.string(),
      description: z.string().min(1).max(800),
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

export const GapItemSchema = z.object({
  requirement: z.string(),
  status: z.enum(["matched", "transferable", "missing"]),
  evidenceSkillIds: z.array(z.string()).optional(),
  evidenceFactIds: z.array(z.string()).optional(),
  transferableVia: z.string().optional(),
});

export const JobAnalysisSchema = z.object({
  detectedTitle: z.string().optional(),
  seniority: z.string().optional(),
  roleFamilyId: z.string(),
  roleFamilyLabel: z.string(),
  requirements: z.array(z.string()),
  gapAnalysis: z.array(GapItemSchema),
  coverage: z.object({
    matched: z.number(),
    transferable: z.number(),
    missing: z.number(),
    total: z.number(),
  }),
});

export type JobAnalysis = z.infer<typeof JobAnalysisSchema>;

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
});

export type TailorResponse = z.infer<typeof TailorResponseSchema>;
