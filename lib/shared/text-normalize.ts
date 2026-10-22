/**
 * Models like to emit typographic characters (non-breaking hyphen U+2011, narrow spaces, ...)
 * that PT Serif's latin subset has no glyph for. Map them to plain ASCII before measuring/rendering.
 */
export function normalizeTypography(text: string): string {
  return text
    .replace(/[\u2010\u2011\u2012\u2043\u2212\uFE63\uFF0D]/g, "-")
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, "")
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201F]/g, '"')
    .replace(/\u2026/g, "...");
}
