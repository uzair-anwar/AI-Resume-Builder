import type { ResumeView } from "@/lib/schemas/resume";
import type { LayoutCtx } from "@/lib/resume/engine/ctx";
import type { TemplateSpec } from "@/lib/resume/engine/types";
import type { LayoutProfile } from "@/lib/resume/layout/profile";
import { DEFAULT_PROFILE } from "@/lib/resume/layout/profile";
import { isCloudCategory, skillText } from "@/lib/resume/layout/skill-line";
import { companyLine, formatDates, stripUrl } from "./shared";

/**
 * MERN master: two-column PT Serif layout, US Letter, black rules under section titles.
 * Geometry measured from Resumes/Uzair_MERN.pdf (FlowCV export).
 */
const L = { x: 39.7, w: 257.3 };
const R = { x: 315, w: 257.3 };
const BULLET_INDENT = 8.1;
const BULLET_GAP = 0.3;
const SECTION_GAP = 22.5;

export const MERN_PROFILE: LayoutProfile = { ...DEFAULT_PROFILE, templateId: "mern" };

function heading(c: LayoutCtx, title: string, col: { x: number; w: number }, y: number): void {
  c.text({ x: col.x, y, text: title, size: 11, style: "bold", uppercase: true, spacing: 0.33 });
  c.rect(col.x + 0.05, y + 3, col.w - 0.05, 1.5);
}

function layout(view: ResumeView, c: LayoutCtx): void {
  const p = view.person;
  const lh = c.lh;

  // Header
  c.text({ x: L.x, y: 45, text: p.name, size: 20, style: "bold" });
  c.text({ x: L.x, y: 62.25, text: view.headline, size: 12.5, style: "italic" });
  c.icon("pin", 40.99, 74.52, 6.75, 8.73);
  c.text({
    x: 54.6,
    y: 81,
    text: p.phone?.trim() ? `${p.location}   |   ${p.phone.trim()}` : p.location,
    size: 9,
  });
  c.icon("mail", 315.66, 75.75, 7.68, 6);
  c.text({ x: 329.9, y: 81, text: p.email, size: 9, link: `mailto:${p.email}` });
  c.icon("chain", 40.29, 91.23, 7.98, 8);
  c.text({ x: 54.6, y: 97.5, text: stripUrl(p.github), size: 9, link: p.github });
  c.icon("linkedin", 315, 90.75, 9, 9);
  c.text({ x: 329.9, y: 97.5, text: stripUrl(p.linkedin), size: 9, link: p.linkedin });

  // Left column
  let t = 120.75;
  heading(c, "Summary", L, t);
  let y = c.paragraph({ text: view.summary, x: L.x, y: t + 17.25, width: L.w, justify: true }).next;
  t = y - lh + SECTION_GAP;

  heading(c, "Skills", L, t);
  y = t + 18.75;
  view.skills.forEach((cat, i) => {
    if (!cat.items.length) return;
    c.text({ x: L.x, y, text: cat.categoryLabel, size: 9.5, style: "bold" });
    const r = c.paragraph({
      text: skillText(
        { categoryId: cat.categoryId, names: cat.items.map((s) => s.name), role: cat.role },
        c.spec.profile.skills,
      ),
      x: L.x,
      y: y + lh,
      width: L.w,
      justify: !isCloudCategory(cat.categoryId, cat.role),
    });
    y = r.next - lh + 2 * lh;
  });
  t = y - 2 * lh + SECTION_GAP;

  heading(c, "Projects", L, t);
  y = t + 18.75;
  view.projects.forEach((proj, i) => {
    const w = c.text({ x: L.x, y, text: proj.name, size: 9.5, style: "bold", link: proj.link || undefined });
    if (proj.link) c.icon("chain", L.x + w + 4, y - 7.2, 7, 7);
    const r = c.paragraph({ text: proj.description, x: L.x, y: y + 10.5, width: L.w, justify: true });
    y = r.next - lh + 17.25;
  });
  c.mark("left", y - 17.25);

  // Right column
  t = 120.75;
  heading(c, "Professional Experience", R, t);
  y = t + 18;
  view.experience.forEach((exp) => {
    c.text({ x: R.x, y, text: exp.title, size: 9.5, style: "bold" });
    c.text({ x: R.x, y: y + 10.5, text: companyLine(exp), size: 9.5, style: "italic" });
    c.text({ x: R.x, y: y + 22.5, text: formatDates(exp.startDate, exp.endDate, "numeric"), size: 9.5 });
    let by = y + 33;
    exp.bullets.forEach((b, i) => {
      if (i > 0) by += BULLET_GAP;
      c.dot(R.x + 0.75, by);
      by = c.paragraph({ text: b.text, x: R.x + BULLET_INDENT, y: by, width: R.w - BULLET_INDENT }).next;
    });
    y = by - lh + 17.25;
  });
  t = y - 17.25 + SECTION_GAP;

  heading(c, "Education", R, t);
  y = t + 18.75;
  view.education.forEach((e) => {
    c.text({ x: R.x, y, text: e.degree, size: 9.5, style: "bold" });
    c.text({ x: R.x, y: y + 10.5, text: e.institution, size: 9.5, style: "italic" });
    y += 21 + 3;
  });
  c.mark("right", Math.max(t + 18.75, y - 24 + 10.5));
}

export const MERN_TEMPLATE: TemplateSpec = {
  id: "mern",
  label: "MERN / Full Stack",
  description: "Two columns, PT Serif, black section rules (US Letter).",
  page: { width: 612, height: 792 },
  profile: MERN_PROFILE,
  bottomLimit: 755.5,
  dateFormat: "numeric",
  layout,
};
