"use client";

import { useEffect, useState } from "react";
import { fontsLoaded, loadFontsInBrowser, type FontFamilyKey } from "@/lib/resume/layout/fonts";
import { getTemplate } from "@/lib/resume/templates/registry";
import { setActiveProfile } from "@/lib/resume/layout/profile";

/**
 * Activates the template's layout profile and loads its font files (needed for exact text measuring
 * and for react-pdf). Returns true once measuring is accurate for that template.
 */
export function useLayoutFonts(templateId?: string): boolean {
  const spec = getTemplate(templateId);
  const families: FontFamilyKey[] = [spec.profile.fontFamily, ...(spec.extraFonts ?? [])];
  const key = families.join(",");
  setActiveProfile(spec.profile);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    if (families.every((f) => fontsLoaded(f))) return;
    let alive = true;
    loadFontsInBrowser(families)
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoadedKey(key);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return loadedKey === key || families.every((f) => fontsLoaded(f));
}

