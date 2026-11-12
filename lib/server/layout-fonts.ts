import "server-only";
import fs from "fs";
import path from "path";
import { FONT_FAMILIES, ALL_FONT_FAMILIES, type FontStyleKey } from "@/lib/resume/layout/font-families";
import { fontsLoaded, registerFontData } from "@/lib/resume/layout/fonts";

/** Loads every bundled font family once on the server so line budgets use real glyph widths. */
export function ensureServerFonts(): void {
  const dir = process.env.RESUME_FONT_DIR || path.join(process.cwd(), "public", "fonts");
  for (const family of ALL_FONT_FAMILIES) {
    if (fontsLoaded(family)) continue;
    for (const [key, file] of Object.entries(FONT_FAMILIES[family].files) as [FontStyleKey, string][]) {
      registerFontData(family, key, new Uint8Array(fs.readFileSync(path.join(dir, file))));
    }
  }
}

ensureServerFonts();
