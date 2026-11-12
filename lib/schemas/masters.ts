import { z } from "zod";

/** One master resume in `data/resumes/index.json`. */
export const MasterEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string(),
  /** Layout template (see lib/resume/templates/registry.ts). */
  templateId: z.string(),
  /** Content file relative to data/resumes. */
  file: z.string(),
  /** Role families (data/role-families.json ids) this master is the best fit for. */
  roleFamilies: z.array(z.string()).default([]),
  /** Preferred ordering of experience/skills etc. is decided by the template, not here. */
  description: z.string().optional(),
});

export const MasterIndexSchema = z.object({
  defaultId: z.string(),
  resumes: z.array(MasterEntrySchema).min(1),
});

export type MasterEntry = z.infer<typeof MasterEntrySchema>;
export type MasterIndex = z.infer<typeof MasterIndexSchema>;

/** What the browser needs to build the dropdown. */
export type MasterOption = Pick<MasterEntry, "id" | "label" | "templateId" | "roleFamilies" | "description">;
