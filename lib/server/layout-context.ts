import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { DEFAULT_PROFILE, setProfileProvider, type LayoutProfile } from "@/lib/resume/layout/profile";
import { getTemplate } from "@/lib/resume/templates/registry";
import { getMasterEntry } from "@/lib/server/resume/registry";
import "@/lib/server/layout-fonts";

const store = new AsyncLocalStorage<LayoutProfile>();
setProfileProvider(() => store.getStore() ?? DEFAULT_PROFILE);

/**
 * Runs `fn` with the layout profile (fonts, widths, line height) of the given master resume
 * active, so every line count / text fit inside it measures against that template.
 */
export function withMaster<T>(masterId: string | undefined | null, fn: () => T): T {
  const entry = getMasterEntry(masterId);
  return store.run(getTemplate(entry.templateId).profile, fn);
}
