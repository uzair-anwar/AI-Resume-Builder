import "server-only";
import { readFileSync } from "fs";
import path from "path";
import { MasterIndexSchema, type MasterEntry, type MasterIndex, type MasterOption } from "@/lib/schemas/masters";
import { MasterResumeSchema, type MasterResume } from "@/lib/schemas/resume";
import { dedupeSkills } from "@/lib/skills/dedupe-skills";
const DIR = path.join(process.cwd(), "data", "resumes");

let indexCache: MasterIndex | null = null;
const masterCache = new Map<string, MasterResume>();

export function loadMasterIndex(): MasterIndex {
  if (indexCache) return indexCache;
  const raw = JSON.parse(readFileSync(path.join(DIR, "index.json"), "utf8"));
  const parsed = MasterIndexSchema.parse(raw);
  if (!parsed.resumes.some((r) => r.id === parsed.defaultId)) {
    throw new Error(`data/resumes/index.json: defaultId "${parsed.defaultId}" is not in resumes`);
  }
  indexCache = parsed;
  return parsed;
}

export function getMasterEntry(masterId?: string | null): MasterEntry {
  const index = loadMasterIndex();
  return (
    index.resumes.find((r) => r.id === masterId) ??
    index.resumes.find((r) => r.id === index.defaultId)!
  );
}

export function listMasterOptions(): MasterOption[] {
  return loadMasterIndex().resumes.map(({ id, label, templateId, roleFamilies, description }) => ({
    id,
    label,
    templateId,
    roleFamilies,
    description,
  }));
}

/** Loads (and caches) the content of one master resume. Unknown ids fall back to the default. */
export function loadMaster(masterId?: string | null): MasterResume {
  const entry = getMasterEntry(masterId);
  const hit = masterCache.get(entry.id);
  if (hit) return hit;
  const raw = JSON.parse(readFileSync(path.join(DIR, entry.file), "utf8"));
  const parsed = MasterResumeSchema.parse(raw);
  const master = parsed.allowDuplicateSkills ? parsed : dedupeSkills(parsed);
  masterCache.set(entry.id, master);
  return master;
}
