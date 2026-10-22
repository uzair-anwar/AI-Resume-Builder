import type { ResumeView } from "@/lib/schemas/resume";

/** Keep tailored content but refresh contact fields from the master profile (e.g. after adding phone). */
export function mergeResumeContactFromMaster(
  view: ResumeView,
  masterPerson: ResumeView["person"],
): ResumeView {
  return {
    ...view,
    person: {
      ...view.person,
      location: view.person.location?.trim() || masterPerson.location,
      phone: view.person.phone?.trim() || masterPerson.phone || "",
      email: view.person.email?.trim() || masterPerson.email,
      github: view.person.github || masterPerson.github,
      linkedin: view.person.linkedin || masterPerson.linkedin,
      name: view.person.name || masterPerson.name,
      defaultHeadline: view.person.defaultHeadline || masterPerson.defaultHeadline,
    },
  };
}
