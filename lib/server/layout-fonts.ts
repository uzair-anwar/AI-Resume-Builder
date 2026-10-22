import "server-only";
import fs from "fs";
import path from "path";
import { FONT_FILES, fontsLoaded, registerFontData, type FontStyleKey } from "@/lib/resume/layout/fonts";

/** Loads PT Serif once on the server so line budgets use real glyph widths. */
export function ensureServerFonts(): void {
  if (fontsLoaded()) return;
  for (const key of Object.keys(FONT_FILES) as FontStyleKey[]) {
    const file = path.join(process.cwd(), "public", "fonts", FONT_FILES[key]);
    registerFontData(key, new Uint8Array(fs.readFileSync(file)));
  }
}

ensureServerFonts();
