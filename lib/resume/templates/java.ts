import type { ResumeView } from "@/lib/schemas/resume";
import type { LayoutCtx } from "@/lib/resume/engine/ctx";
import type { TemplateSpec } from "@/lib/resume/engine/types";
import type { LayoutProfile } from "@/lib/resume/layout/profile";
import { isCloudCategory } from "@/lib/resume/layout/skill-line";
import { contactWidth, contactItem, drawMarker, drawSkills, formatDates, stripUrl } from "./shared";

/**
 * Java master: centred header, two columns with shaded bars, Source Sans Pro body (A4).
 * Geometry measured from Resumes/Uzair_Java.pdf.
 */
const CENTER = 297.75;
const L = { x: 28.34, box: 28.5, w: 260.29, bar: 260.25 };
const R = { x: 306.63, box: 306.75, w: 260.29, bar: 260.25 };
const BULLET_INDENT = 8.09;
const LH = 10.5;
const SECTION_GAP = 11.25;

export const JAVA_PROFILE: LayoutProfile = {
  templateId: "java",
  fontFamily: "source-sans-pro",
  bodySize: 9,
  lineHeight: LH,
  summaryWidth: R.w,
  skillsWidth: R.w,
  projectWidth: L.w - BULLET_INDENT,
  bulletWidth: L.w - BULLET_INDENT,
  projectBulletWidth: L.w - BULLET_INDENT,
  skills: { sep: " • ", cloudSep: " • ", foldAws: "inplace", labelInline: false, markerIndent: 8.09, inlineInset: 2.1 },
  projectStyle: "bullets",
  headline: { style: "pipe", maxChars: 72 },
};

function bar(c: LayoutCtx, title: string, box: number, w: number, top: number): number {
  c.rect(box, top, w, 16.5, "#000000", { opacity: 0.07 });
  c.text({ x: box + w / 2, y: top + 12, text: title, size: 10.5, style: "bold", align: "center", spacing: 0.335 });
  return top + 28.75;
}

function layout(view: ResumeView, c: LayoutCtx): void {
  const p = view.person;

  // Header (centred)
  c.text({ x: CENTER, y: 41.25, text: p.name, size: 16.99, style: "bold", uppercase: true, align: "center" });
  c.text({ x: CENTER, y: 57, text: view.headline, size: 10.99, align: "center" });
  const items = [
    { kind: "pin" as const, text: p.location, link: undefined },
    { kind: "mail" as const, text: p.email, link: `mailto:${p.email}` },
    { kind: "linkedin" as const, text: stripUrl(p.linkedin), link: p.linkedin },
    { kind: "github" as const, text: stripUrl(p.github), link: p.github },
  ];
  const GAP = 9;
  const total = items.reduce((a, it) => a + contactWidth(c, it.text, 4.88), 0) + GAP * (items.length - 1);
  let x = CENTER - total / 2;
  for (const it of items) {
    x = contactItem(c, { kind: it.kind, boxX: x, baseline: 76.5, text: it.text, gap: 4.88, link: it.link }) + GAP;
  }

  // Left column
  let y = bar(c, "Professional Experience", L.box, L.bar, 92.25);
  let last = y;
  view.experience.forEach((exp) => {
    c.text({
      x: L.x,
      y,
      runs: [
        { text: exp.title, style: "bold" },
        { text: `, ${exp.company}`, style: "regular" },
      ],
      size: 9,
    });
    c.text({ x: L.x, y: y + 12, text: formatDates(exp.startDate, exp.endDate, "short-month"), size: 9 });
    let by = y + 23.25;
    exp.bullets.forEach((b) => {
      drawMarker(c, "dot", L.box + 0.75, by);
      by = c.paragraph({ text: b.text, x: L.x + BULLET_INDENT, y: by, width: L.w - BULLET_INDENT }).next;
    });
    last = by - LH;
    y = last + 15.75;
  });
  c.mark("left", last);

  y = bar(c, "Projects", L.box, L.bar, last + SECTION_GAP);
  view.projects.forEach((proj) => {
    const w = c.text({ x: L.x, y, text: proj.name, size: 9, style: "bold", link: proj.link || undefined });
    if (proj.link) c.icon("chain", L.x + w + 4, y - 7.2, 7, 7);
    let by = y;
    if (proj.tagline) {
      c.text({ x: L.x, y: y + LH, text: proj.tagline, size: 9 });
      by = y + LH;
    }
    by += 5.25 + LH;
    const bullets = proj.bullets?.length ? proj.bullets.map((b) => b.text) : [proj.description];
    bullets.forEach((text) => {
      drawMarker(c, "dot", L.box + 0.75, by);
      by = c.paragraph({ text, x: L.x + BULLET_INDENT, y: by, width: L.w - BULLET_INDENT, justify: true }).next;
    });
    last = by - LH;
    y = last + 15.75;
  });
  c.mark("left", last);

  y = bar(c, "Education", L.box, L.bar, last + SECTION_GAP);
  view.education.forEach((e) => {
    c.text({ x: L.x, y, text: `${e.degree},`, size: 9, style: "bold" });
    c.text({ x: L.x, y: y + LH, text: e.institution, size: 9 });
    last = y + LH;
    y += 2 * LH + 5.25;
  });
  c.mark("left", last);

  // Right column
  y = bar(c, "Summary", R.box, R.bar, 92.25);
  last = c.paragraph({ text: view.summary, x: R.x, y, width: R.w, justify: true }).next - LH;
  y = bar(c, "Skills", R.box, R.bar, last + SECTION_GAP);
  last = drawSkills(c, view, {
    x: R.x,
    width: R.w,
    y,
    lineHeight: LH,
    gap: 18.19,
    marker: { kind: "dot", dx: 0.75 + (R.box - R.x) },
    justify: (cat) => isCloudCategory(cat.categoryId, cat.role),
  });
  c.mark("right", last);
}

export const JAVA_TEMPLATE: TemplateSpec = {
  id: "java",
  label: "Java",
  description: "Centred header, shaded section bars, Source Sans Pro (A4).",
  page: { width: 594.96, height: 841.92 },
  profile: JAVA_PROFILE,
  bottomLimit: 790,
  dateFormat: "short-month",
  layout,
};
