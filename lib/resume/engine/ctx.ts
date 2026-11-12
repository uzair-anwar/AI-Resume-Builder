import { normalizeTypography } from "@/lib/shared/text-normalize";
import { wrapAtomicUnits, wrapText, type WrappedLine } from "@/lib/resume/layout/rich-wrap";
import { resolveFontStyle, type FontFamilyKey, type FontStyleKey } from "@/lib/resume/layout/font-families";
import { GLUE_SPACE, textWidth } from "@/lib/resume/layout/fonts";
export type { WrappedLine };
import type { IconKind, LayoutResult, Op, Run, TemplateSpec } from "./types";

const BLACK = "#000000";

type TextOpts = {
  x: number;
  /** Baseline. */
  y: number;
  text?: string;
  runs?: Run[];
  size: number;
  style?: FontStyleKey;
  family?: FontFamilyKey;
  color?: string;
  spacing?: number;
  link?: string;
  /** "center": x is the centre; "right": x is the right edge. */
  align?: "left" | "center" | "right";
  uppercase?: boolean;
};

export type ParagraphOpts = {
  text: string;
  x: number;
  /** Baseline of the first line. */
  y: number;
  width: number;
  size?: number;
  lineHeight?: number;
  style?: FontStyleKey;
  family?: FontFamilyKey;
  color?: string;
  justify?: boolean;
  maxLines?: number;
};

export type ParagraphResult = { lines: number; next: number; width: number };

/** Collects ops for one resume layout pass. */
export class LayoutCtx {
  readonly ops: Op[] = [];
  private readonly bottoms: Record<string, number> = {};
  readonly family: FontFamilyKey;
  readonly size: number;
  readonly lh: number;
  /** Baselines snap to this grid (pt) like the browser does at 1 CSS px. */
  readonly grid: number;

  constructor(
    readonly spec: TemplateSpec,
    opts: { grid?: number } = {},
  ) {
    this.family = spec.profile.fontFamily;
    this.size = spec.profile.bodySize;
    this.lh = spec.profile.lineHeight;
    this.grid = opts.grid ?? 0.75;
  }

  snap(y: number): number {
    return this.grid > 0 ? Math.round(y / this.grid) * this.grid : y;
  }

  /** Track the lowest baseline of a column for overflow detection. */
  mark(column: string, baseline: number): void {
    this.bottoms[column] = Math.max(this.bottoms[column] ?? 0, baseline);
  }

  width(text: string, size: number, style: FontStyleKey = "regular", family: FontFamilyKey = this.family, spacing = 0): number {
    return textWidth(text, size, style, family) + spacing * text.length;
  }

  runsWidth(runs: Run[], size: number, family: FontFamilyKey = this.family, spacing = 0): number {
    return runs.reduce((a, r) => a + this.width(r.text, size, r.style, family, spacing), 0);
  }

  /** Single line of text. Returns its width. */
  text(o: TextOpts): number {
    const family = o.family ?? this.family;
    const style = o.style ?? "regular";
    const raw = o.runs ?? [{ text: o.text ?? "", style }];
    const runs = raw.map((r) => ({
      text: normalizeTypography(o.uppercase ? r.text.toUpperCase() : r.text).replaceAll(GLUE_SPACE, " "),
      style: resolveFontStyle(family, r.style),
    }));
    const w = this.runsWidth(runs, o.size, family, o.spacing ?? 0);
    let x = o.x;
    if (o.align === "center") x = o.x - w / 2;
    else if (o.align === "right") x = o.x - w;
    this.ops.push({
      t: "text",
      x,
      y: this.snap(o.y),
      runs,
      family,
      size: o.size,
      color: o.color ?? BLACK,
      spacing: o.spacing || undefined,
      link: o.link,
      w,
    });
    return w;
  }

  rect(x: number, y: number, w: number, h: number, fill = BLACK, extra: { opacity?: number; radius?: number } = {}): void {
    this.ops.push({ t: "rect", x, y, w, h, fill, ...extra });
  }

  icon(kind: IconKind, x: number, y: number, w: number, h: number, color = BLACK): void {
    this.ops.push({ t: "icon", kind, x, y, w, h, color });
  }

  /** Round bullet marker (3pt) whose vertical centre sits at the x-height of its text line. */
  dot(x: number, baseline: number, d = 3, color = BLACK): void {
    this.rect(x, this.snap(baseline) - 3.57 - (d - 3) / 2, d, d, color, { radius: d / 2 });
  }

  /**
   * Greedy wrap of plain or rich-markup text into lines of styled word units. Rich text is measured
   * with each word's own style (bold labels, italic words), plain text with whole-line kerning.
   */
  wrap(text: string, width: number, o: { size?: number; style?: FontStyleKey; family?: FontFamilyKey } = {}): WrappedLine[] {
    return wrapText(text, width, o.size ?? this.size, o.style ?? "regular", o.family ?? this.family);
  }

  /** Greedy fill of atomic units (never split inside a unit); every line is plain text. */
  wrapUnits(
    units: string[],
    width: number,
    o: { size?: number; style?: FontStyleKey; family?: FontFamilyKey; sep?: string } = {},
  ): WrappedLine[] {
    return wrapAtomicUnits(units, width, o.size ?? this.size, o.style ?? "regular", o.family ?? this.family, o.sep);
  }

  /** Draws already-broken lines by baseline. Justified lines place each unit at a computed x. */
  placeLines(
    lines: WrappedLine[],
    o: {
      x: number;
      y: number;
      width: number;
      size?: number;
      lineHeight?: number;
      family?: FontFamilyKey;
      color?: string;
      justify?: boolean;
      maxLines?: number;
      sep?: string;
    },
  ): ParagraphResult {
    const size = o.size ?? this.size;
    const lh = o.lineHeight ?? this.lh;
    const family = o.family ?? this.family;
    const sep = o.sep ?? " ";
    let y = o.y;
    let n = 0;
    for (const line of lines.slice(0, o.maxLines ?? lines.length)) {
      if (o.justify && !line.last && line.units.length > 1) {
        const widths = line.units.map((u) => this.runsWidth(u, size, family));
        const gap = (o.width - widths.reduce((a, b) => a + b, 0)) / (widths.length - 1);
        let x = o.x;
        line.units.forEach((runs, i) => {
          this.text({ x, y, runs, size, family, color: o.color });
          x += widths[i]! + gap;
        });
      } else {
        const runs: Run[] = [];
        line.units.forEach((u, i) => {
          if (i > 0) runs.push({ text: sep, style: u[0]?.style ?? "regular" });
          runs.push(...u);
        });
        this.text({ x: o.x, y, runs, size, family, color: o.color });
      }
      y += lh;
      n++;
    }
    return { lines: n, next: y, width: o.width };
  }

  /**
   * Wrapped paragraph. Justified lines place each word at a computed x (space-between), like
   * Chrome's justified output.
   */
  paragraph(o: ParagraphOpts): ParagraphResult {
    const lines = this.wrap(o.text, o.width, { size: o.size, style: o.style, family: o.family });
    return this.placeLines(lines, o);
  }

  finish(): LayoutResult {
    const worst = Math.max(0, ...Object.values(this.bottoms));
    return {
      ops: this.ops,
      page: this.spec.page,
      bottoms: { ...this.bottoms },
      overflow: Math.max(0, worst - this.spec.bottomLimit),
    };
  }
}
