import type { ResumeView } from "@/lib/schemas/resume";
import type { FontFamilyKey, FontStyleKey } from "@/lib/resume/layout/font-families";
import type { LayoutProfile } from "@/lib/resume/layout/profile";

/** One styled piece of a text line. */
export type Run = { text: string; style: FontStyleKey };

export type IconKind = "pin" | "mail" | "chain" | "linkedin" | "github";

/**
 * Display list: everything is placed by absolute coordinates (pt, origin top-left, text by
 * baseline). Preview, one-page fitting and the PDF all use the same list, so what is measured
 * is exactly what is drawn.
 */
export type Op =
  | {
      t: "text";
      x: number;
      /** Baseline y. */
      y: number;
      runs: Run[];
      family: FontFamilyKey;
      size: number;
      color: string;
      /** Extra letter spacing (pt). */
      spacing?: number;
      link?: string;
      /** Measured width (pt). */
      w: number;
    }
  | { t: "rect"; x: number; y: number; w: number; h: number; fill: string; opacity?: number; radius?: number }
  | { t: "icon"; kind: IconKind; x: number; y: number; w: number; h: number; color: string };

export type DateFormat = "numeric" | "short-month";

export type TemplateSpec = {
  id: string;
  label: string;
  /** One-line description for pickers and docs. */
  description: string;
  page: { width: number; height: number; background?: string };
  profile: LayoutProfile;
  /** Extra font families used besides the body family (e.g. a script font for the name). */
  extraFonts?: FontFamilyKey[];
  /** Last baseline allowed in any column (pt); content below overflows the page. */
  bottomLimit: number;
  dateFormat: DateFormat;
  /** Draws the whole resume into the context. */
  layout: (view: ResumeView, ctx: import("./ctx").LayoutCtx) => void;
};

export type LayoutResult = {
  ops: Op[];
  page: TemplateSpec["page"];
  /** Lowest baseline used (pt) per named column. */
  bottoms: Record<string, number>;
  /** Pt beyond the allowed bottom (0 when it fits). */
  overflow: number;
};
