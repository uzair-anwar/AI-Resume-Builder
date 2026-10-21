import { z } from "zod";

export const ExtractJobRequestSchema = z.object({
  url: z.string().url().max(2048),
});

export const ExtractJobResponseSchema = z.object({
  title: z.string().optional(),
  description: z.string(),
  source: z.enum(["greenhouse", "lever", "ashby", "jsonld", "html", "paste"]),
  warnings: z.array(z.string()).optional().default([]),
});

export const TailorRequestSchema = z.object({
  jobDescription: z.string().min(50).max(20000),
  jobTitle: z.string().max(200).optional(),
  model: z.string().max(120).optional(),
  profileOverride: z.record(z.string(), z.unknown()).optional(),
});

export type TailorRequest = z.infer<typeof TailorRequestSchema>;
