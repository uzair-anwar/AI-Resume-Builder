import * as fontkit from "fontkit";
import {
  ALL_FONT_FAMILIES,
  FONT_FAMILIES,
  resolveFontStyle,
  type FontFamilyKey,
  type FontStyleKey,
} from "./font-families";
import { activeProfile } from "./profile";

export type { FontStyleKey, FontFamilyKey } from "./font-families";

/** Back-compat: file names of the original PT Serif template. */
export const FONT_FILES = FONT_FAMILIES["pt-serif"].files as Record<FontStyleKey, string>;

type Registry = Partial<Record<FontStyleKey, fontkit.Font>>;
const registry: Partial<Record<FontFamilyKey, Registry>> = {};
const loading: Partial<Record<FontFamilyKey, Promise<void>>> = {};

function activeFamily(): FontFamilyKey {
  return activeProfile().fontFamily;
}

export function registerFontData(family: FontFamilyKey, key: FontStyleKey, data: Uint8Array): void {
  const font = fontkit.create(data as unknown as Buffer);
  (registry[family] ??= {})[key] =
    "fonts" in font ? (font as unknown as fontkit.FontCollection).fonts[0] : font;
}

export function fontsLoaded(family: FontFamilyKey = activeFamily()): boolean {
  return Boolean(registry[family]?.regular);
}

/** Browser: fetch the bundled font files of the given families (once each). */
export function loadFontsInBrowser(
  families: FontFamilyKey[] = [activeFamily()],
  baseUrl = "/fonts",
): Promise<void> {
  return Promise.all(
    families.map((family) => {
      if (fontsLoaded(family)) return Promise.resolve();
      loading[family] ??= Promise.all(
        (Object.entries(FONT_FAMILIES[family].files) as [FontStyleKey, string][]).map(
          async ([key, file]) => {
            const res = await fetch(`${baseUrl}/${file}`);
            if (!res.ok) throw new Error(`Font ${file} failed to load`);
            registerFontData(family, key, new Uint8Array(await res.arrayBuffer()));
          },
        ),
      ).then(() => undefined);
      return loading[family]!;
    }),
  ).then(() => undefined);
}

export { ALL_FONT_FAMILIES };

function fontFor(family: FontFamilyKey, style: FontStyleKey): fontkit.Font | undefined {
  const reg = registry[family];
  return reg?.[resolveFontStyle(family, style)] ?? reg?.regular;
}

/** Distance from the top of the text box to the baseline, in em (react-pdf places text with this ascent). */
export function ascentRatio(family: FontFamilyKey, style: FontStyleKey = "regular"): number {
  const font = fontFor(family, style);
  if (!font) return 1;
  return font.ascent / font.unitsPerEm;
}

const widthCache = new Map<string, number>();

/** Width in pt of a single-line string. Falls back to an estimate if fonts are not loaded. */
/** A space that never breaks a line (renders as a normal space). Used for "• item" skill units. */
export const GLUE_SPACE = "\uE000";

export function textWidth(
  text: string,
  size: number,
  style: FontStyleKey = "regular",
  family: FontFamilyKey = activeFamily(),
): number {
  if (text.includes(GLUE_SPACE)) text = text.replaceAll(GLUE_SPACE, " ");
  const font = fontFor(family, style);
  if (!font) return text.length * size * 0.5;
  const cacheKey = `${family}|${style}|${size}|${text}`;
  const hit = widthCache.get(cacheKey);
  if (hit !== undefined) return hit;
  const run = font.layout(text);
  const w = (run.advanceWidth * size) / font.unitsPerEm;
  if (widthCache.size > 40000) widthCache.clear();
  widthCache.set(cacheKey, w);
  return w;
}
