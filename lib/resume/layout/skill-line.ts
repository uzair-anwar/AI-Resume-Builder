import type { FontFamilyKey } from "./font-families";
import { GLUE_SPACE } from "./fonts";
import { activeProfile, type SkillFormat } from "./profile";
import { wrapText, type WrappedLine } from "./rich-wrap";

/**
 * Formats the skills of one category the way the template PDF prints them.
 * Cloud skills are folded ("Azure, AWS (Amplify Gen 2, AppSync, ..., CDK)") and joined with the
 * template's cloud separator, everything else with its normal separator.
 */
const AWS_SERVICE_NAMES = new Set(["DynamoDB", "S3", "CloudFront", "API Gateway"]);

export type SkillCategoryInput = {
  categoryId: string;
  /** Printed label (needed when the template prints "Label: items"). */
  label?: string;
  role?: string;
  bulletStyle?: "marker" | "inline";
  names: string[];
  /** Parallel to `names`: a row of "• item" units ends after this item. */
  breaks?: boolean[];
};

export function isCloudCategory(categoryId: string, role?: string): boolean {
  return role === "cloud" || categoryId === "cat-cloud";
}

/** Folds AWS services into one `AWS (...)` item, keeping the other items in order. */
export function foldCloudItems(names: string[], placement: SkillFormat["foldAws"]): string[] {
  const out: string[] = [];
  const services: string[] = [];
  let hasAws = false;
  let awsAt = -1;

  for (const name of names) {
    if (name === "AWS" || name.startsWith("AWS ") || AWS_SERVICE_NAMES.has(name)) {
      if (awsAt < 0) awsAt = out.length;
      if (name === "AWS") hasAws = true;
      else services.push(name.startsWith("AWS ") ? name.slice(4) : name);
    } else {
      out.push(name);
    }
  }
  if (!hasAws && !services.length) return out;
  const folded = services.length ? `AWS (${services.join(", ")})` : "AWS";
  if (placement === "end") out.push(folded);
  else out.splice(awsAt, 0, folded);
  return out;
}

/** Markup string of one category (without marker / label line); wraps like the browser does. */
export function skillText(cat: SkillCategoryInput, fmt: SkillFormat = activeProfile().skills): string {
  const cloud = isCloudCategory(cat.categoryId, cat.role);
  const items = cloud ? foldCloudItems(cat.names, fmt.foldAws) : cat.names;
  let text: string;
  if (cat.bulletStyle === "inline" && cloud) {
    // Cloud stays one justified paragraph that merely starts with a bullet.
    text = `•${GLUE_SPACE}${items.join(" • ")}`;
  } else if (cat.bulletStyle === "inline") {
    // "• item" units never split; only the folded AWS list may wrap inside its parentheses.
    text = items
      .map((i) => `•${GLUE_SPACE}${i.startsWith("AWS (") ? i : i.replaceAll(" ", GLUE_SPACE)}`)
      .join(" ");
  }
  else text = items.join(cloud ? fmt.cloudSep : fmt.sep);
  if (fmt.labelInline && cat.label) text = `**${cat.label}:** ${text}`;
  return text;
}

export function skillLines(
  cat: SkillCategoryInput,
  width: number,
  size: number,
  family?: FontFamilyKey,
  fmt: SkillFormat = activeProfile().skills,
): WrappedLine[] {
  const cloud = isCloudCategory(cat.categoryId, cat.role);
  if (cat.bulletStyle === "inline" && !cloud) {
    // Rows of atomic "• item" units; rows end where the source resume ended them.
    const w = width - (fmt.inlineInset ?? 0);
    const rows: string[][] = [[]];
    cat.names.forEach((name, i) => {
      rows[rows.length - 1]!.push(name);
      if (cat.breaks?.[i] && i < cat.names.length - 1) rows.push([]);
    });
    return rows.flatMap((names) => wrapText(skillText({ ...cat, names }, fmt), w, size, "regular", family));
  }
  const w = cat.bulletStyle === "marker" ? width - fmt.markerIndent : width;
  return wrapText(skillText(cat, fmt), w, size, "regular", family);
}

/** Back-compat: single-line text of a category using the active template. */
export function formatSkillLine(categoryId: string, names: string[], role?: string): string {
  return skillText({ categoryId, names, role });
}
