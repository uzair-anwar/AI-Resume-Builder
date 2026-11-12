/** Bundled font families (woff files in public/fonts, all SIL OFL via @fontsource). */
export type FontStyleKey = "regular" | "bold" | "italic" | "boldItalic";

export type FontFamilyKey =
  "pt-serif" | "crimson-text" | "lobster" | "source-sans-pro" | "jost" | "alegreya";

export type FontFamilyDef = {
  key: FontFamilyKey;
  label: string;
  /** Files by style; missing styles fall back (boldItalic → bold/italic → regular). */
  files: Partial<Record<FontStyleKey, string>>;
};

export const FONT_FAMILIES: Record<FontFamilyKey, FontFamilyDef> = {
  "pt-serif": {
    key: "pt-serif",
    label: "PT Serif",
    files: {
      regular: "pt-serif-latin-400-normal.woff",
      bold: "pt-serif-latin-700-normal.woff",
      italic: "pt-serif-latin-400-italic.woff",
      boldItalic: "pt-serif-latin-700-italic.woff",
    },
  },
  "crimson-text": {
    key: "crimson-text",
    label: "Crimson Text",
    files: {
      regular: "crimson-text-latin-400-normal.woff",
      bold: "crimson-text-latin-700-normal.woff",
      italic: "crimson-text-latin-400-italic.woff",
      boldItalic: "crimson-text-latin-700-italic.woff",
    },
  },
  lobster: {
    key: "lobster",
    label: "Lobster",
    files: { regular: "lobster-latin-400-normal.woff" },
  },
  "source-sans-pro": {
    key: "source-sans-pro",
    label: "Source Sans Pro",
    files: {
      regular: "source-sans-pro-latin-400-normal.woff",
      bold: "source-sans-pro-latin-700-normal.woff",
      italic: "source-sans-pro-latin-400-italic.woff",
      boldItalic: "source-sans-pro-latin-700-italic.woff",
    },
  },
  jost: {
    key: "jost",
    label: "Jost",
    files: {
      regular: "jost-latin-400-normal.woff",
      bold: "jost-latin-700-normal.woff",
      italic: "jost-latin-400-italic.woff",
      boldItalic: "jost-latin-700-italic.woff",
    },
  },
  alegreya: {
    key: "alegreya",
    label: "Alegreya",
    files: {
      regular: "alegreya-latin-400-normal.woff",
      bold: "alegreya-latin-700-normal.woff",
      italic: "alegreya-latin-400-italic.woff",
      boldItalic: "alegreya-latin-700-italic.woff",
    },
  },
};

export const ALL_FONT_FAMILIES = Object.keys(FONT_FAMILIES) as FontFamilyKey[];

/** The style actually available for a family (what react-pdf will really draw). */
export function resolveFontStyle(family: FontFamilyKey, style: FontStyleKey): FontStyleKey {
  const files = FONT_FAMILIES[family].files;
  if (files[style]) return style;
  if (style === "boldItalic") return files.bold ? "bold" : files.italic ? "italic" : "regular";
  return "regular";
}
