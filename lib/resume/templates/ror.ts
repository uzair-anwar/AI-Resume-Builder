import type { ResumeView } from "@/lib/schemas/resume";
import type { LayoutCtx } from "@/lib/resume/engine/ctx";
import type { TemplateSpec } from "@/lib/resume/engine/types";
import type { LayoutProfile } from "@/lib/resume/layout/profile";
import { isCloudCategory } from "@/lib/resume/layout/skill-line";
import { contactItem, contactWidth, drawMarker, drawSkills, formatDates, stripUrl } from "./shared";

/**
 * Ruby on Rails master: centred header, section titles between two thin rules, Alegreya body (A4).
 * Geometry measured from Resumes/Uzair_ROR.pdf.
 */
const CENTER = 297.75;
const L = { x: 28.34, box: 28.5, w: 260.29, rule: 260.25 };
const R = { x: 306.63, box: 306.75, w: 260.29, rule: 260.25 };
const BULLET_INDENT = 8.09;
const LH = 9.75;
const SECTION_GAP = 12;

export const ROR_PROFILE: LayoutProfile = {
  templateId: "ror",
  fontFamily: "alegreya",
  bodySize: 9,
  lineHeight: LH,
  summaryWidth: L.w,
  skillsWidth: L.w,
  projectWidth: R.w - BULLET_INDENT,
  bulletWidth: R.w - BULLET_INDENT,
  projectBulletWidth: R.w - BULLET_INDENT,
  skills: { sep: " • ", cloudSep: " • ", foldAws: "inplace", labelInline: false, markerIndent: 8.09, inlineInset: 2.1 },
  projectStyle: "bullets",
  headline: { style: "pipe", maxChars: 72 },
};

/** Draws a title between two thin rules at `top`; returns the first content baseline. */
function heading(c: LayoutCtx, title: string, box: number, w: number, top: number): number {
  c.rect(box, top, w, 0.75);
  c.rect(box, top + 16.5, w, 0.75);
  c.text({ x: box + w / 2, y: top + 12, text: title, size: 10, style: "bold", uppercase: true, align: "center", spacing: 0.33 });
  return top + 28.5;
}

function layout(view: ResumeView, c: LayoutCtx): void {
  const p = view.person;

  // Header (centred)
  c.text({ x: CENTER, y: 38.25, text: p.name, size: 13.99, style: "bold", uppercase: true, align: "center" });
  c.text({ x: CENTER, y: 53.25, text: view.headline, size: 10.99, style: "italic", align: "center" });
  const items = [
    { kind: "pin" as const, text: p.location, link: undefined },
    { kind: "mail" as const, text: p.email, link: `mailto:${p.email}` },
    { kind: "linkedin" as const, text: stripUrl(p.linkedin), link: p.linkedin },
    { kind: "github" as const, text: stripUrl(p.github), link: p.github },
  ];
  const GAP = 9.2;
  const TG = 4.35;
  const total = items.reduce((a, it) => a + contactWidth(c, it.text, TG), 0) + GAP * (items.length - 1);
  let x = CENTER - total / 2;
  for (const it of items) {
    x = contactItem(c, { kind: it.kind, boxX: x, baseline: 71.25, text: it.text, gap: TG, link: it.link }) + GAP;
  }

  // Left column: summary, skills, education
  let y = heading(c, "Summary", L.box, L.rule, 86.25);
  let last = c.paragraph({ text: view.summary, x: L.x, y, width: L.w, justify: true }).next - LH;

  y = heading(c, "Skills", L.box, L.rule, last + SECTION_GAP);
  last = drawSkills(c, view, {
    x: L.x,
    width: L.w,
    y,
    lineHeight: LH,
    gap: 17.25,
    marker: { kind: "dot", dx: 0.91 },
    justify: (cat) => isCloudCategory(cat.categoryId, cat.role),
  });

  y = heading(c, "Education", L.box, L.rule, last + SECTION_GAP);
  view.education.forEach((e) => {
    c.text({ x: L.x, y, text: e.degree, size: 9, style: "bold" });
    c.text({ x: L.x, y: y + LH, text: e.institution, size: 9, style: "italic" });
    last = y + LH;
    y += 2 * LH + 5.25;
  });
  c.mark("left", last);

  // Right column: experience, projects
  y = heading(c, "Professional Experience", R.box, R.rule, 86.25);
  view.experience.forEach((exp) => {
    c.text({
      x: R.x,
      y,
      runs: [
        { text: `${exp.company}, `, style: "bold" },
        { text: exp.title, style: "italic" },
      ],
      size: 9,
    });
    c.text({ x: R.x, y: y + 11.25, text: formatDates(exp.startDate, exp.endDate, "short-month"), size: 9 });
    let by = y + 21.75;
    exp.bullets.forEach((b) => {
      drawMarker(c, "dot", R.box + 0.75, by);
      by = c.paragraph({ text: b.text, x: R.x + BULLET_INDENT, y: by, width: R.w - BULLET_INDENT }).next;
    });
    last = by - LH;
    y = last + 15;
  });
  c.mark("right", last);

  y = heading(c, "Projects", R.box, R.rule, last + SECTION_GAP);
  view.projects.forEach((proj) => {
    const w = c.text({ x: R.x, y, text: proj.name, size: 9, style: "bold", link: proj.link || undefined });
    if (proj.link) c.icon("chain", R.x + w + 4, y - 7.2, 7, 7);
    let by = y;
    if (proj.tagline) {
      c.text({ x: R.x, y: y + LH, text: proj.tagline, size: 9 });
      by = y + LH;
    }
    by += LH + 5.25;
    const bullets = proj.bullets?.length ? proj.bullets.map((b) => b.text) : [proj.description];
    bullets.forEach((text) => {
      drawMarker(c, "dot", R.box + 0.75, by);
      by = c.paragraph({ text, x: R.x + BULLET_INDENT, y: by, width: R.w - BULLET_INDENT }).next;
    });
    last = by - LH;
    y = last + 15;
  });
  c.mark("right", last);
}

export const ROR_TEMPLATE: TemplateSpec = {
  id: "ror",
  label: "Ruby on Rails",
  description: "Centred header, titles between thin rules, Alegreya body (A4).",
  page: { width: 594.96, height: 841.92 },
  profile: ROR_PROFILE,
  bottomLimit: 790,
  dateFormat: "short-month",
  layout,
};
