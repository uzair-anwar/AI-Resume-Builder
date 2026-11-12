import { Font } from "@react-pdf/renderer";
import { ALL_FONT_FAMILIES, FONT_FAMILIES } from "@/lib/resume/layout/font-families";

/** Browser: "/fonts". Node scripts set RESUME_FONT_DIR to the absolute public/fonts directory. */
const FONT_BASE = process.env.RESUME_FONT_DIR || "/fonts";

let done = false;

/** Registers every bundled family with react-pdf (idempotent). Family names are `rf-<key>`. */
export function registerPdfFonts(): void {
  if (done) return;
  done = true;
  for (const key of ALL_FONT_FAMILIES) {
    const files = FONT_FAMILIES[key].files;
    const fonts: { src: string; fontWeight?: number; fontStyle?: "italic" | "normal" }[] = [];
    if (files.regular) fonts.push({ src: `${FONT_BASE}/${files.regular}`, fontWeight: 400 });
    if (files.italic) fonts.push({ src: `${FONT_BASE}/${files.italic}`, fontWeight: 400, fontStyle: "italic" });
    if (files.bold) fonts.push({ src: `${FONT_BASE}/${files.bold}`, fontWeight: 700 });
    if (files.boldItalic) fonts.push({ src: `${FONT_BASE}/${files.boldItalic}`, fontWeight: 700, fontStyle: "italic" });
    Font.register({ family: pdfFamilyName(key), fonts });
  }
  /** Lines are broken by our own measured layout; never let react-pdf hyphenate. */
  Font.registerHyphenationCallback((word) => [word]);
}

export function pdfFamilyName(key: string): string {
  return `rf-${key}`;
}
