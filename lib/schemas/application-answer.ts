import { z } from "zod";
import { ResumeViewSchema } from "./resume";
import { AiUsageSchema } from "./tailoring";

export const ApplicationAnswerSchema = z.object({
  answer: z.string().min(40).max(6000),
});

export type ApplicationAnswer = z.infer<typeof ApplicationAnswerSchema>;

export const ApplicationAnswerRequestSchema = z.object({
  question: z.string().min(5).max(2000),
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

export type ApplicationAnswerRequest = z.infer<typeof ApplicationAnswerRequestSchema>;

export const ApplicationAnswerResponseSchema = z.object({
  question: z.string(),
  answer: z.string(),
  aiUsage: AiUsageSchema.optional(),
  warnings: z.array(z.string()),
});

export type ApplicationAnswerResponse = z.infer<typeof ApplicationAnswerResponseSchema>;
