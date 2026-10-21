import * as fontkit from "fontkit";

export type FontStyleKey = "regular" | "bold" | "italic" | "boldItalic";

export const FONT_FILES: Record<FontStyleKey, string> = {
  regular: "pt-serif-latin-400-normal.woff",
  bold: "pt-serif-latin-700-normal.woff",
  italic: "pt-serif-latin-400-italic.woff",
  boldItalic: "pt-serif-latin-700-italic.woff",
};

const fonts: Partial<Record<FontStyleKey, fontkit.Font>> = {};
let loading: Promise<void> | null = null;

export function registerFontData(key: FontStyleKey, data: Uint8Array): void {
  // fontkit accepts Uint8Array / Buffer
  const font = fontkit.create(data as unknown as Buffer);
  fonts[key] = "fonts" in font ? (font as unknown as fontkit.FontCollection).fonts[0] : font;
}

export function fontsLoaded(): boolean {
  return Boolean(fonts.regular);
}

/** Browser: fetch the bundled PT Serif files once (needed for exact line measurement). */
export function loadFontsInBrowser(baseUrl = "/fonts"): Promise<void> {
  if (fontsLoaded()) return Promise.resolve();
  loading ??= Promise.all(
    (Object.keys(FONT_FILES) as FontStyleKey[]).map(async (key) => {
      const res = await fetch(`${baseUrl}/${FONT_FILES[key]}`);
      if (!res.ok) throw new Error(`Font ${FONT_FILES[key]} failed to load`);
      registerFontData(key, new Uint8Array(await res.arrayBuffer()));
    }),
  ).then(() => undefined);
  return loading;
}

const widthCache = new Map<string, number>();

/** Width in pt of a single-line string. Falls back to an estimate if fonts are not loaded. */
export function textWidth(text: string, size: number, style: FontStyleKey = "regular"): number {
  const font = fonts[style] ?? fonts.regular;
  if (!font) return text.length * size * 0.5;
  const cacheKey = `${style}|${size}|${text}`;
  const hit = widthCache.get(cacheKey);
  if (hit !== undefined) return hit;
  const run = font.layout(text);
  const w = (run.advanceWidth * size) / font.unitsPerEm;
  if (widthCache.size > 20000) widthCache.clear();
  widthCache.set(cacheKey, w);
  return w;
}
