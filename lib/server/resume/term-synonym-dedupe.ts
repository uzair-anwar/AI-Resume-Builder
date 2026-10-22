import "server-only";
import {
  buildSynonymGroupsFromTerms,
  dedupeSynonymsInText,
} from "@/lib/term-synonym-dedupe";
import { listAllTaxonomyTerms } from "./taxonomy";

let cachedGroups: ReturnType<typeof buildSynonymGroupsFromTerms> | null = null;

function synonymGroups() {
  if (!cachedGroups) {
    cachedGroups = buildSynonymGroupsFromTerms(
      listAllTaxonomyTerms().filter((t) => t.kind === "tool" || t.aliases.length > 0),
    );
  }
  return cachedGroups;
}

export function dedupeResumeSynonyms(text: string): string {
  return dedupeSynonymsInText(text, synonymGroups());
}
