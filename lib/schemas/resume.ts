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
  /** Inline "• item" rows (Java, ROR): the row ends after this skill. */
  breakAfter: z.boolean().optional(),
});

export const SkillCategorySchema = z.object({
  id: z.string(),
  label: z.string(),
  /** Semantic role used by tailoring and layout (e.g. "cloud"); replaces hard-coded category ids. */
  role: z.string().optional(),
  /**
   * How this category's text is bulleted: "marker" = real list item (round marker, indented),
   * "inline" = every wrapped line starts with a literal "•", otherwise plain text.
   */
  bulletStyle: z.enum(["marker", "inline"]).optional(),
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
  /** Short subtitle under the project name (e.g. "Financial Analytics Platform"). */
  tagline: z.string().optional(),
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
  phone: z.string().optional().default(""),
  email: z.string().email(),
  github: z.string().url(),
  linkedin: z.string().url(),
});

export const MasterResumeSchema = z.object({
  version: z.number(),
  /** Keep the same skill name in several categories (as printed in the source PDF). */
  allowDuplicateSkills: z.boolean().optional(),
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
      role: z.string().optional(),
      bulletStyle: z.enum(["marker", "inline"]).optional(),
      items: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          userAttested: z.boolean().optional(),
          breakAfter: z.boolean().optional(),
        }),
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
      /** One-line subtitle shown under the project name (bullet-style templates). */
      tagline: z.string().optional(),
      /** Bullet form of the project (bullet-style templates). Falls back to `description`. */
      bullets: z.array(z.object({ text: z.string(), sourceFactIds: z.array(z.string()) })).optional(),
      sourceFactIds: z.array(z.string()),
    }),
  ),
  education: z.array(EducationSchema),
});

export type ResumeView = z.infer<typeof ResumeViewSchema>;
