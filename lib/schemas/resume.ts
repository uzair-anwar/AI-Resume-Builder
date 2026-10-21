import { z } from "zod";

export const FactSchema = z.object({
  id: z.string(),
  text: z.string(),
  skills: z.array(z.string()).optional().default([]),
  metricsVerified: z.boolean().optional(),
});

export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  categoryId: z.string(),
  aliases: z.array(z.string()).optional().default([]),
  userAttested: z.boolean().optional(),
  level: z.enum(["familiar", "proficient", "expert"]).optional(),
});

export const SkillCategorySchema = z.object({
  id: z.string(),
  label: z.string(),
});

export const ExperienceSchema = z.object({
  id: z.string(),
  company: z.string(),
  title: z.string(),
  location: z.string().optional().default(""),
  startDate: z.string(),
  endDate: z.string().nullable(),
  facts: z.array(FactSchema),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  link: z.string().url().optional().or(z.literal("")).optional(),
  facts: z.array(FactSchema),
});

export const EducationSchema = z.object({
  id: z.string(),
  degree: z.string(),
  institution: z.string(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
});

export const PersonSchema = z.object({
  name: z.string(),
  defaultHeadline: z.string(),
  location: z.string(),
  email: z.string().email(),
  github: z.string().url(),
  linkedin: z.string().url(),
});

export const MasterResumeSchema = z.object({
  version: z.number(),
  person: PersonSchema,
  summaryFacts: z.array(FactSchema),
  skillCategories: z.array(SkillCategorySchema),
  skills: z.array(SkillSchema),
  experience: z.array(ExperienceSchema),
  projects: z.array(ProjectSchema),
  education: z.array(EducationSchema),
  certifications: z
    .array(z.object({ id: z.string(), name: z.string() }))
    .optional()
    .default([]),
});

export type MasterResume = z.infer<typeof MasterResumeSchema>;
export type Fact = z.infer<typeof FactSchema>;

export const ResumeViewSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  person: PersonSchema,
  skills: z.array(
    z.object({
      categoryId: z.string(),
      categoryLabel: z.string(),
      items: z.array(
        z.object({ id: z.string(), name: z.string(), userAttested: z.boolean().optional() }),
      ),
    }),
  ),
  experience: z.array(
    z.object({
      id: z.string(),
      company: z.string(),
      title: z.string(),
      location: z.string(),
      startDate: z.string(),
      endDate: z.string().nullable(),
      bullets: z.array(z.object({ text: z.string(), sourceFactIds: z.array(z.string()) })),
    }),
  ),
  projects: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      link: z.string().optional(),
      description: z.string(),
      sourceFactIds: z.array(z.string()),
    }),
  ),
  education: z.array(EducationSchema),
});

export type ResumeView = z.infer<typeof ResumeViewSchema>;
