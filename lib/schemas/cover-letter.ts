import { z } from "zod";
import { ResumeViewSchema } from "./resume";
import { AiUsageSchema } from "./tailoring";

export const CoverLetterVariantsSchema = z.object({
  companyName: z.string().min(1).max(120),
  roleTitle: z.string().min(1).max(120),
  standard: z.string().min(40).max(4000),
  shortMessage: z.string().min(20).max(1500),
  talkingPoints: z.array(z.string().min(5).max(500)).min(2).max(8),
});

export type CoverLetterVariants = z.infer<typeof CoverLetterVariantsSchema>;

export const CoverLetterRequestSchema = z.object({
  jobDescription: z.string().min(50).max(20000),
  jobTitle: z.string().max(150).optional(),
  tailoredResume: ResumeViewSchema.optional(),
  provider: z.enum(["auto", "groq", "openrouter", "gemini", "cloudflare"]).optional(),
  providerModels: z
    .record(
      z.enum(["groq", "openrouter", "gemini", "cloudflare"]),
      z.string().max(200),
    )
    .optional(),
  allowProviderFallback: z.boolean().optional(),
  profileOverride: z.record(z.string(), z.unknown()).optional(),
});

export type CoverLetterRequest = z.infer<typeof CoverLetterRequestSchema>;

export const CoverLetterResponseSchema = z.object({
  coverLetter: CoverLetterVariantsSchema,
  aiUsage: AiUsageSchema.optional(),
  usedFallback: z.boolean().optional(),
  warnings: z.array(z.string()),
});

export type CoverLetterResponse = z.infer<typeof CoverLetterResponseSchema>;
