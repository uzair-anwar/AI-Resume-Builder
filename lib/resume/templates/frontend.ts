import type { ResumeView } from "@/lib/schemas/resume";
import type { LayoutCtx } from "@/lib/resume/engine/ctx";
import type { TemplateSpec } from "@/lib/resume/engine/types";
import type { LayoutProfile } from "@/lib/resume/layout/profile";
import { contactItem, drawMarker, drawSkills, formatDates, stripUrl } from "./shared";

/**
 * Frontend master: tinted header band, two columns with shaded section bars, Crimson Text body and a
 * Lobster name (A4). Geometry measured from Resumes/Uzair_Frontend.pdf.
 */
const BOX = { l: 28.5, r: 312 }; // bar / icon box x
const L = { x: 28.34, w: 265.66, bar: 265.5 };
const R = { x: 312.01, w: 254.9, bar: 255 };
const BULLET_INDENT = 8.09;
const LH = 9.75;

export const FRONTEND_PROFILE: LayoutProfile = {
  templateId: "frontend",
  fontFamily: "crimson-text",
  bodySize: 9,
  lineHeight: LH,
  summaryWidth: R.w,
  skillsWidth: R.w,
  projectWidth: L.w - BULLET_INDENT,
  bulletWidth: L.w - BULLET_INDENT,
  projectBulletWidth: L.w - BULLET_INDENT,
  skills: { sep: " • ", cloudSep: " • ", foldAws: "inplace", labelInline: false, markerIndent: 8.1 },
  projectStyle: "bullets",
  headline: { style: "pipe", maxChars: 72 },
};

function bar(c: LayoutCtx, title: string, x: number, w: number, top: number): number {
  c.rect(x, top, w, 15.75, "#000000", { opacity: 0.07 });
  c.text({ x: x + w / 2, y: top + 10.5, text: title, size: 10, style: "bold", uppercase: true, align: "center", spacing: 0.385 });
  return top + 27;
}

function layout(view: ResumeView, c: LayoutCtx): void {
  const p = view.person;

  // Header
  c.rect(0, 0, 595.5, 112.5, "#d8e4eb");
  c.text({ x: L.x, y: 40.5, text: p.name, size: 15.49, family: "lobster", spacing: 0.68 });
  c.text({ x: L.x, y: 54.75, text: view.headline, size: 10.99, style: "italic" });
  contactItem(c, { kind: "mail", boxX: BOX.l, baseline: 72, text: p.email, gap: 5.77, link: `mailto:${p.email}` });
  contactItem(c, { kind: "linkedin", boxX: BOX.l, baseline: 87.75, text: stripUrl(p.linkedin), gap: 5.77, link: p.linkedin });
  contactItem(c, { kind: "pin", boxX: BOX.r - 5.25, baseline: 72, text: p.location, gap: 5.81 });
  contactItem(c, { kind: "github", boxX: BOX.r - 5.25, baseline: 87.75, text: stripUrl(p.github), gap: 5.81, link: p.github });

  // Left column: experience, projects
  let t = 129;
  let y = bar(c, "Professional Experience", BOX.l, L.bar, t);
  let last = y;
  view.experience.forEach((exp) => {
    c.text({ x: L.x, y, text: exp.company, style: "bold", size: 9 });
    c.text({ x: L.x, y: y + LH, text: exp.title, style: "italic", size: 9 });
    c.text({ x: L.x, y: y + 2 * LH + 0.75, text: formatDates(exp.startDate, exp.endDate, "numeric"), size: 9 });
    let by = y + 3 * LH + 1.5;
    exp.bullets.forEach((b) => {
      drawMarker(c, "dash", L.x, by);
      by = c.paragraph({ text: b.text, x: L.x + BULLET_INDENT, y: by, width: L.w - BULLET_INDENT, justify: true }).next;
    });
    last = by - LH;
    y = last + 15;
  });
  c.mark("left", last);

  t = last + 15.75;
  y = bar(c, "Projects", BOX.l, L.bar, t);
  view.projects.forEach((proj) => {
    const w = c.text({ x: L.x, y, text: proj.name, style: "bold", size: 9, link: proj.link || undefined });
    if (proj.link) c.icon("chain", L.x + w + 4, y - 7.2, 7, 7);
    let by = y + LH;
    const bullets = proj.bullets?.length ? proj.bullets.map((b) => b.text) : [proj.description];
    bullets.forEach((text) => {
      drawMarker(c, "dash", L.x, by);
      by = c.paragraph({ text, x: L.x + BULLET_INDENT, y: by, width: L.w - BULLET_INDENT, justify: true }).next;
    });
    last = by - LH;
    y = last + 15.08;
  });
  c.mark("left", last);

  // Right column: summary, skills, education
  y = bar(c, "Summary", BOX.r, R.bar, 129);
  last = c.paragraph({ text: view.summary, x: R.x, y, width: R.w, justify: true }).next - LH;

  y = bar(c, "Skills", BOX.r, R.bar, last + 10.5);
  last = drawSkills(c, view, {
    x: R.x,
    width: R.w,
    y,
    lineHeight: LH,
    gap: 17.25,
    markerGap: 5.25,
    marker: { kind: "dash", dx: 0 },
    justify: true,
  });

  y = bar(c, "Education", BOX.r, R.bar, last + 10.5);
  view.education.forEach((e) => {
    c.text({ x: R.x, y, text: e.degree, style: "bold", size: 9 });
    c.text({ x: R.x, y: y + LH, text: e.institution, style: "italic", size: 9 });
    last = y + LH;
    y += 2 * LH + 5.25;
  });
  c.mark("right", last);
}

export const FRONTEND_TEMPLATE: TemplateSpec = {
  id: "frontend",
  label: "Frontend",
  description: "Tinted header band, shaded section bars, Crimson Text and a script name (A4).",
  page: { width: 594.96, height: 841.92 },
  profile: FRONTEND_PROFILE,
  extraFonts: ["lobster"],
  bottomLimit: 790,
  dateFormat: "numeric",
  layout,
};
