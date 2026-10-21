import "server-only";
import { readFileSync } from "fs";
import path from "path";
import { normalizeText } from "./taxonomy";

export type RoleFamily = {
  id: string;
  label: string;
  detectionKeywords: string[];
  priorityCategoryIds: string[];
  headlinePattern: string;
  summaryEmphasis: string;
};

let cached: RoleFamily[] | null = null;

export function loadRoleFamilies(): RoleFamily[] {
  if (cached) return cached;
  const file = path.join(process.cwd(), "data", "role-families.json");
  const raw = JSON.parse(readFileSync(file, "utf8")) as { families: RoleFamily[] };
  cached = raw.families;
  return cached;
}

export function detectRoleFamily(jobText: string, overrideId?: string): RoleFamily {
  const families = loadRoleFamilies();
  if (overrideId) {
    const found = families.find((f) => f.id === overrideId);
    if (found) return found;
  }
  const hay = normalizeText(jobText);
  let best = families.find((f) => f.id === "generic")!;
  let bestScore = 0;
  for (const f of families) {
    if (f.id === "generic") continue;
    let score = 0;
    for (const kw of f.detectionKeywords) {
      const k = normalizeText(kw);
      if (k.length < 2) continue;
      if (hay.includes(k)) score += k.includes(" ") ? 3 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best;
}
