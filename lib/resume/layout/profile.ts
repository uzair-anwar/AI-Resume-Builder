import type { FontFamilyKey } from "./font-families";

/** How a template prints the items of a skill category. */
export type SkillFormat = {
  /** Between items on plain and marker lines (MERN " | ", others " • "). */
  sep: string;
  /** Between items of the cloud category (MERN ", "). */
  cloudSep: string;
  /** AWS services are folded into "AWS (a, b)": at the end (MERN) or where AWS first appears. */
  foldAws: "end" | "inplace";
  /** "Label: items" run together in one paragraph (Python) instead of a label line above. */
  labelInline: boolean;
  /** Text indent of marker-style lines. */
  markerIndent: number;
  /** Rows of "• item" units wrap this much narrower than the column (Java, ROR). */
  inlineInset?: number;
};

/**
 * Measurements that depend on the selected resume template. Line counting, text fitting and
 * validation all read the *active* profile so the same code works for every master resume.
 */
export type LayoutProfile = {
  templateId: string;
  /** Font family used for body text measuring. */
  fontFamily: FontFamilyKey;
  bodySize: number;
  lineHeight: number;
  /** Wrap width (pt) for summary, skills and project text. */
  summaryWidth: number;
  skillsWidth: number;
  projectWidth: number;
  /** Wrap width of an experience bullet / project bullet. */
  bulletWidth: number;
  projectBulletWidth: number;
  skills: SkillFormat;
  /** Projects print as one justified paragraph (MERN) or as a bulleted list under an optional tagline. */
  projectStyle: "paragraph" | "bullets";
  /** How the tailored headline is written: "Title (A · B)" or "Title | A, B & C". */
  headline: { style: "paren" | "pipe"; maxChars: number };
  /** Optional per-template overrides of the tailoring line caps. */
  caps?: Partial<TailorCaps>;
};

export type TailorCaps = {
  bulletMax: number;
  bulletMin: number;
  /** Max wrapped lines of a project paragraph (bullet-style projects are kept verbatim). */
  projectMax: number;
  summaryMax: number;
  /** Upper bound of the skills block (the master's own line count is used when smaller). */
  skillsMax: number;
  /** Bullets may not grow beyond the lines the master prints them in (keeps the master's page rhythm). */
  exactBullets: boolean;
};

/** Default = the original single-master template (MERN). Kept here to avoid import cycles. */
export const DEFAULT_PROFILE: LayoutProfile = {
  templateId: "mern",
  fontFamily: "pt-serif",
  bodySize: 9,
  lineHeight: 9.75,
  summaryWidth: 257.3,
  skillsWidth: 257.3,
  projectWidth: 257.3,
  bulletWidth: 257.3 - 8.1,
  projectBulletWidth: 257.3 - 8.1,
  skills: { sep: " | ", cloudSep: ", ", foldAws: "end", labelInline: false, markerIndent: 8.1 },
  projectStyle: "paragraph",
  headline: { style: "paren", maxChars: 115 },
};

let provider: () => LayoutProfile = () => DEFAULT_PROFILE;

/** Server installs an AsyncLocalStorage-backed provider; the browser uses setActiveProfile. */
export function setProfileProvider(fn: () => LayoutProfile): void {
  provider = fn;
}

let clientProfile: LayoutProfile = DEFAULT_PROFILE;

/** Browser: remember the template of the resume being edited. */
export function setActiveProfile(profile: LayoutProfile): void {
  clientProfile = profile;
  provider = () => clientProfile;
}

export function activeProfile(): LayoutProfile {
  return provider();
}

/** Tailoring line caps of the active template (MERN-tuned defaults, overridable per template). */
export function tailorCaps(): TailorCaps {
  return {
    bulletMax: 3,
    bulletMin: 2,
    projectMax: activeProfile().projectStyle === "bullets" ? 24 : 7,
    summaryMax: 8,
    skillsMax: activeProfile().templateId === "mern" ? 20 : 99,
    exactBullets: activeProfile().templateId !== "mern",
    ...activeProfile().caps,
  };
}
