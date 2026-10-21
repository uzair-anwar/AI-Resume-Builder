import { z } from "zod";
import { MasterResumeSchema } from "./resume";

export const ProfileOverrideSchema = MasterResumeSchema.partial().extend({
  attestedSkills: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        categoryId: z.string(),
        level: z.enum(["familiar", "proficient", "expert"]),
      }),
    )
    .optional(),
});

export type ProfileOverride = z.infer<typeof ProfileOverrideSchema>;
