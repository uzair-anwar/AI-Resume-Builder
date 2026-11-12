import type { ResumeView } from "@/lib/schemas/resume";
import type { LayoutCtx } from "@/lib/resume/engine/ctx";
import type { TemplateSpec } from "@/lib/resume/engine/types";
import type { LayoutProfile } from "@/lib/resume/layout/profile";
import { contactItem, drawMarker, drawSkills, formatDates, stripUrl } from "./shared";

/**
 * Python master: name and headline on one line, a single contact row, ruled uppercase section
 * titles, Jost body with inline "Label: items" skills (A4). Geometry from Resumes/Uzair_Python.pdf.
 */
const L = { x: 28.34, box: 28.5, w: 233.3, rule: 233.25 };
const R = { x: 279.7, box: 279.75, w: 287.25, rule: 287.25 };
const BULLET_INDENT = 8.1;
const LH = 12;

export const PYTHON_PROFILE: LayoutProfile = {
  templateId: "python",
  fontFamily: "jost",
  bodySize: 9,
  lineHeight: LH,
  summaryWidth: L.w,
  skillsWidth: L.w,
  projectWidth: R.w - BULLET_INDENT,
  bulletWidth: R.w - BULLET_INDENT,
  projectBulletWidth: R.w - BULLET_INDENT,
  skills: { sep: " • ", cloudSep: " • ", foldAws: "inplace", labelInline: true, markerIndent: 8.1 },
  projectStyle: "bullets",
  headline: { style: "pipe", maxChars: 62 },
};

function heading(c: LayoutCtx, title: string, box: number, w: number, baseline: number, offset = 18.75): number {
  c.text({ x: box - 0.16, y: baseline, text: title, size: 10, style: "bold", uppercase: true, spacing: 0.37 });
  c.rect(box, baseline + 3, w, 1.5);
  return baseline + offset;
}

function layout(view: ResumeView, c: LayoutCtx): void {
  const p = view.person;

  // Header: name + headline on one baseline, then one contact row
  const nameW = c.text({ x: L.x, y: 46.5, text: p.name, size: 15.49, style: "bold", uppercase: true });
  c.text({ x: L.x + nameW + 9.3, y: 46.5, text: view.headline, size: 10.99, style: "italic" });
  const items = [
    { kind: "mail" as const, text: p.email, link: `mailto:${p.email}` },
    { kind: "pin" as const, text: p.location, link: undefined },
    { kind: "linkedin" as const, text: stripUrl(p.linkedin), link: p.linkedin },
    { kind: "github" as const, text: stripUrl(p.github), link: p.github },
  ];
  let x = L.box;
  for (const it of items) {
    x = contactItem(c, { kind: it.kind, boxX: x, baseline: 66.75, text: it.text, gap: 5.3, link: it.link }) + 12.8;
  }

  // Left column: summary, skills, education
  let y = heading(c, "Summary", L.box, L.rule, 96);
  let last = c.paragraph({ text: view.summary, x: L.x, y, width: L.w, justify: true }).next - LH;

  y = heading(c, "Skills", L.box, L.rule, last + 23.25, 19.5);
  last = drawSkills(c, view, {
    x: L.x,
    width: L.w,
    y,
    lineHeight: LH,
    gap: 16.5,
    marker: { kind: "dot", dx: 0.8 },
    justify: false,
  });

  y = heading(c, "Education", L.box, L.rule, last + 23.25, 18.75);
  view.education.forEach((e) => {
    c.text({ x: L.x, y, text: e.degree, size: 9, style: "bold" });
    c.text({ x: L.x, y: y + LH, text: e.institution, size: 9, style: "italic" });
    last = y + LH;
    y += 2 * LH + 6.75;
  });
  c.mark("left", last);

  // Right column: experience, projects
  y = heading(c, "Professional Experience", R.box, R.rule, 96);
  view.experience.forEach((exp) => {
    c.text({ x: R.x, y, text: exp.title, size: 9, style: "bold" });
    c.text({ x: R.x, y: y + LH, text: exp.company, size: 9, style: "italic" });
    c.text({ x: R.x, y: y + LH + 13.5, text: formatDates(exp.startDate, exp.endDate, "short-month"), size: 9 });
    let by = y + LH + 13.5 + 12.75;
    exp.bullets.forEach((b) => {
      drawMarker(c, "dot", R.box + 0.75, by);
      by = c.paragraph({ text: b.text, x: R.x + BULLET_INDENT, y: by, width: R.w - BULLET_INDENT, justify: true }).next;
    });
    last = by - LH;
    y = last + 18.75;
  });
  c.mark("right", last);

  y = heading(c, "Projects", R.box, R.rule, last + 23.25, 19.5);
  view.projects.forEach((proj) => {
    const w = c.text({ x: R.x, y, text: proj.name, size: 9, style: "bold", link: proj.link || undefined });
    if (proj.link) c.icon("chain", R.x + w + 4, y - 7.2, 7, 7);
    let by = y;
    if (proj.tagline) {
      c.text({ x: R.x, y: y + LH, text: proj.tagline, size: 9, style: "italic" });
      by = y + LH;
    }
    by += LH;
    const bullets = proj.bullets?.length ? proj.bullets.map((b) => b.text) : [proj.description];
    bullets.forEach((text) => {
      drawMarker(c, "dot", R.box + 0.75, by);
      by = c.paragraph({ text, x: R.x + BULLET_INDENT, y: by, width: R.w - BULLET_INDENT, justify: true }).next;
    });
    last = by - LH;
    y = last + 18.75;
  });
  c.mark("right", last);
}

export const PYTHON_TEMPLATE: TemplateSpec = {
  id: "python",
  label: "Python",
  description: "Ruled uppercase titles, one-line header, Jost body with inline skill labels (A4).",
  page: { width: 594.96, height: 841.92 },
  profile: PYTHON_PROFILE,
  bottomLimit: 790,
  dateFormat: "short-month",
  layout,
};
