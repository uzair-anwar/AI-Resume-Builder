import { z } from "zod";
import { ResumeViewSchema } from "./resume";
import { AiUsageSchema } from "./tailoring";

export const OutreachEmailSchema = z.object({
  companyName: z.string().min(1).max(120),
  roleTitle: z.string().min(1).max(120),
  subject: z.string().min(5).max(200),
  body: z.string().min(40).max(4000),
});

export type OutreachEmail = z.infer<typeof OutreachEmailSchema>;

export const OutreachEmailRequestSchema = z.object({
  jobDescription: z.string().min(50).max(20000),
  jobTitle: z.string().max(150).optional(),
  tailoredResume: ResumeViewSchema.optional(),
  recipientName: z.string().max(120).optional(),
  provider: z.enum(["auto", "groq", "openrouter", "gemini", "cloudflare"]).optional(),
  providerModels: z
    .record(
      z.enum(["groq", "openrouter", "gemini", "cloudflare"]),
      z.string().max(200),
    )
    .optional(),
  allowProviderFallback: z.boolean().optional(),
  profileOverride: z.record(z.string(), z.unknown()).optional(),
  masterId: z.string().optional(),
});

export type OutreachEmailRequest = z.infer<typeof OutreachEmailRequestSchema>;

export const OutreachEmailResponseSchema = z.object({
  email: OutreachEmailSchema,
  aiUsage: AiUsageSchema.optional(),
  usedFallback: z.boolean().optional(),
  warnings: z.array(z.string()),
});

export type OutreachEmailResponse = z.infer<typeof OutreachEmailResponseSchema>;
