import type { ResumeView } from "@/lib/schemas/resume";
import type { LayoutCtx } from "@/lib/resume/engine/ctx";
import type { DateFormat } from "@/lib/resume/engine/types";
import { skillLines } from "@/lib/resume/layout/skill-line";
import { formatDateRange, formatDateRangePdf } from "@/lib/shared/format";

export function stripUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

export function formatDates(start: string, end: string | null, fmt: DateFormat): string {
  return fmt === "numeric" ? formatDateRangePdf(start, end) : formatDateRange(start, end);
}

/** `Company | Location` (location optional). */
export function companyLine(exp: ResumeView["experience"][number]): string {
  return exp.location?.trim() ? `${exp.company}  |  ${exp.location.trim()}` : exp.company;
}

export type Col = { x: number; w: number };

/** Draws a bulleted paragraph: round marker at `markerX`, text at `col.x + indent`. Returns next baseline. */
export function bulletItem(
  c: LayoutCtx,
  o: {
    text: string;
    x: number;
    markerX: number;
    width: number;
    y: number;
    justify?: boolean;
    size?: number;
    lineHeight?: number;
  },
): number {
  c.dot(o.markerX, o.y);
  const r = c.paragraph({
    text: o.text,
    x: o.x,
    y: o.y,
    width: o.width,
    justify: o.justify,
    size: o.size,
    lineHeight: o.lineHeight,
  });
  return r.next;
}

/** Ink offsets of the contact icons relative to their 9pt box (x) and the text baseline (y). */
const ICON_SPEC: Record<"pin" | "mail" | "linkedin" | "github", { dx: number; up: number; w: number; h: number }> = {
  pin: { dx: 1.24, up: 6.48, w: 6.75, h: 8.73 },
  mail: { dx: 0.66, up: 5.25, w: 7.68, h: 6.5 },
  linkedin: { dx: 0, up: 6.75, w: 9, h: 9 },
  github: { dx: 0, up: 6.64, w: 9, h: 8.77 },
};

/**
 * Contact entry: 9pt icon box at `boxX`, text `gap` after the box. Returns the x where the entry ends.
 */
export function contactItem(
  c: LayoutCtx,
  o: {
    kind: "pin" | "mail" | "linkedin" | "github";
    boxX: number;
    baseline: number;
    text: string;
    gap: number;
    size?: number;
    link?: string;
    family?: import("@/lib/resume/layout/font-families").FontFamilyKey;
  },
): number {
  const spec = ICON_SPEC[o.kind];
  c.icon(o.kind, o.boxX + spec.dx, o.baseline - spec.up, spec.w, spec.h);
  const w = c.text({ x: o.boxX + 9 + o.gap, y: o.baseline, text: o.text, size: o.size ?? 9, link: o.link, family: o.family });
  return o.boxX + 9 + o.gap + w;
}

/** Width of a contact entry (icon box + gap + text) without drawing. */
export function contactWidth(c: LayoutCtx, text: string, gap: number, size = 9): number {
  return 9 + gap + c.width(text, size);
}

export type MarkerKind = "dot" | "dash";

/** Bullet marker drawn left of the first line: round dot (3pt) or a text dash. */
export function drawMarker(c: LayoutCtx, kind: MarkerKind, x: number, baseline: number, size = 9): void {
  if (kind === "dot") c.dot(x, baseline);
  else c.text({ x, y: baseline, text: "-", size });
}

export type SkillsOpts = {
  /** Text x of the column and wrap width. */
  x: number;
  width: number;
  /** Baseline of the first category label (or first line when labels are inline). */
  y: number;
  lineHeight: number;
  labelSize?: number;
  /** Label baseline → first line baseline (label above only). */
  labelToText?: number;
  /** Last line baseline → next category's first baseline. */
  gap: number;
  /** Extra gap after a marker-style category. */
  markerGap?: number;
  /** x of the marker (relative to column text x) and its kind. */
  marker: { kind: MarkerKind; dx: number };
  justify: boolean | ((cat: ResumeView["skills"][number]) => boolean);
};

/** Draws all skill categories; returns the baseline of the last text line drawn. */
export function drawSkills(c: LayoutCtx, view: ResumeView, o: SkillsOpts): number {
  const fmt = c.spec.profile.skills;
  let y = o.y;
  let last = y;
  for (const cat of view.skills) {
    if (!cat.items.length) continue;
    const input = {
      categoryId: cat.categoryId,
      label: cat.categoryLabel,
      role: cat.role,
      bulletStyle: cat.bulletStyle,
      names: cat.items.map((s) => s.name),
      breaks: cat.items.map((s) => !!s.breakAfter),
    };
    const marker = cat.bulletStyle === "marker";
    const indent = marker ? fmt.markerIndent : 0;
    let textY = y;
    if (!fmt.labelInline) {
      c.text({ x: o.x, y, text: cat.categoryLabel, size: o.labelSize ?? 9, style: "bold" });
      textY = y + (o.labelToText ?? o.lineHeight);
    }
    const lines = skillLines(input, o.width, c.size, c.family, fmt);
    if (marker) drawMarker(c, o.marker.kind, o.x + o.marker.dx, textY);
    const j = typeof o.justify === "function" ? o.justify(cat) : o.justify;
    const r = c.placeLines(lines, {
      x: o.x + indent,
      y: textY,
      width: o.width - indent,
      lineHeight: o.lineHeight,
      justify: j,
    });
    last = r.next - o.lineHeight;
    y = last + o.gap + (marker ? (o.markerGap ?? 0) : 0);
  }
  return last;
}
