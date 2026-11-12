#!/usr/bin/env node
/**
 * Dev tool: import a reference resume PDF as a master resume (content only).
 *
 * Usage: node scripts/pdf-to-master.mjs <template> <file.pdf> --split X --out data/resumes/<id>/master.json
 *   <template>: mern | frontend | java | python | ror
 *
 * Text is taken from the PDF exactly as printed (wrapped lines are re-joined). Layout is NOT stored
 * here: templates in lib/resume/templates own fonts, columns and spacing.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { execFileSync } from "node:child_process";

const [template, pdf] = process.argv.slice(2);
const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i > 0 ? process.argv[i + 1] : d;
};
const split = arg("--split");
const out = arg("--out");
const tmp = `/tmp/pdf-to-master-${process.pid}.json`;
execFileSync("node", ["scripts/pdf-outline.mjs", pdf, "--split", split, "--json", tmp], { stdio: "ignore" });
const paras = JSON.parse(readFileSync(tmp, "utf8"));
const base = JSON.parse(readFileSync("data/resumes/mern/master.json", "utf8"));

const isBold = (p) => /Bold/.test(p.font);
const isItalic = (p) => /Italic/.test(p.font);
const plain = (t) => t.replace(/\*+/g, "").replace(/\s+/g, " ").trim();
const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---- sections ------------------------------------------------------------------------------
const SECTION = [
  [/^summary$/i, "summary"],
  [/^skills$/i, "skills"],
  [/experience$/i, "experience"],
  [/^projects$/i, "projects"],
  [/^education$/i, "education"],
];
const header = [];
const sections = { summary: [], skills: [], experience: [], projects: [], education: [] };
for (const col of [0, 1]) {
  let cur = null;
  for (const p of paras.filter((q) => q.col === col)) {
    const sec = SECTION.find(([re]) => re.test(p.text.trim()) && (p.isHeading || /Bold/.test(p.font) && p.size >= 9.9));
    if (sec) {
      cur = sec[1];
      continue;
    }
    if (cur) sections[cur].push(p);
    else header.push(p);
  }
}

// ---- helpers ---------------------------------------------------------------------------------
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function parseRange(text) {
  const [a, b] = text.split(/\s+[–-]\s+/);
  const one = (s) => {
    s = s.trim();
    if (/^present$/i.test(s)) return null;
    let m = s.match(/^(\d{2})\/(\d{4})$/);
    if (m) return `${m[2]}-${m[1]}`;
    m = s.match(/^([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
    if (m) return `${m[2]}-${String(MONTHS.indexOf(m[1].toLowerCase()) + 1).padStart(2, "0")}`;
    throw new Error(`Unrecognised date "${s}"`);
  };
  return { startDate: one(a), endDate: one(b) };
}
const isDateLine = (t) => /(\d{4}|\d{2}\/\d{4}).*(–|-).*(Present|\d{4})/.test(t) && t.length < 40;
const sentences = (t) => t.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/).map((s) => s.trim()).filter(Boolean);

const CAT_RULES = [
  [/^(core|programming) languages/i, "languages"],
  [/^frameworks/i, "frameworks"],
  [/^ui engineering/i, "ui"],
  [/^state management/i, "architecture"],
  [/^api/i, "api"],
  [/^databases$/i, "databases"],
  [/^vector/i, "vector"],
  [/^clouds?( platforms)?$/i, "cloud"],
  [/^devops/i, "devops"],
  [/^version control/i, "vcs"],
  [/^ai & automation|^ai engineering/i, "ai"],
  [/^llm/i, "llm"],
  [/^machine learning/i, "ml"],
  [/^messaging|^background/i, "messaging"],
  [/^backend/i, "backend"],
  [/^ruby/i, "ruby"],
  [/^frontend/i, "frontend"],
];
const roleOf = (label) => CAT_RULES.find(([re]) => re.test(label.trim()))?.[1] ?? slug(label);

// ---- skills --------------------------------------------------------------------------------
const skillCategories = [];
const skills = [];
function addCategory(label, text, bulletStyle, lineTexts) {
  const role = roleOf(label);
  let id = `cat-${role}`;
  if (skillCategories.some((c) => c.id === id)) id = `cat-${role}-${skillCategories.length}`;
  const cat = { id, label: label.trim(), role };
  if (bulletStyle) cat.bulletStyle = bulletStyle;
  skillCategories.push(cat);
  let items;
  if (template === "mern") {
    items = role === "cloud" ? foldCloud(text) : text.split(/\s+\|\s+/);
  } else {
    items = text.split(/\s+•\s+/).flatMap((it) => {
      const m = it.replace(/^•\s*/, "").match(/^AWS \((.*)\)$/);
      return m ? ["AWS", ...awsServices(m[1])] : [it];
    });
  }
  const seen = new Set();
  for (const raw of items) {
    const name = raw.replace(/^•\s*/, "").trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    skills.push({ id: `skill-${slug(id.replace("cat-", ""))}-${slug(name)}`, name, categoryId: id, aliases: [] });
  }
  // Inline "• item" rows: remember where the source resume ended each row (not for the cloud paragraph).
  if (bulletStyle === "inline" && role !== "cloud" && lineTexts?.length > 1) {
    const mine = skills.filter((s) => s.categoryId === id);
    let n = 0;
    lineTexts.slice(0, -1).forEach((lt) => {
      n += lt.split(/\s*•\s*/).filter(Boolean).length;
      if (mine[n - 1]) mine[n - 1].breakAfter = true;
    });
  }
}
const SERVICE_PLAIN = new Set(["DynamoDB", "S3", "CloudFront", "API Gateway"]);
/** Service names as stored in the master: well-known ones plain, the rest prefixed with "AWS ". */
const awsServices = (list) => list.split(/,\s*/).map((svc) => (SERVICE_PLAIN.has(svc) ? svc : `AWS ${svc}`));
/** "Azure, AWS (Amplify Gen 2, S3, ...)" → ["Azure", "AWS", "AWS Amplify Gen 2", "S3", ...] (MERN stores AWS services separately). */
function foldCloud(text) {
  const m = text.match(/AWS \(([^)]*)\)/);
  const parts = text.replace(/AWS \([^)]*\)/, "AWS").split(/,\s*/).map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    out.push(p);
    if (p === "AWS" && m) {
      out.push(...awsServices(m[1]));
    }
  }
  return out;
}

if (template === "python") {
  // "Label: item • item …" in one paragraph
  for (const p of sections.skills) {
    const t = plain(p.text);
    const i = t.indexOf(": ");
    addCategory(t.slice(0, i), t.slice(i + 2));
  }
} else {
  const list = sections.skills;
  for (let i = 0; i < list.length; i++) {
    const label = list[i];
    if (!isBold(label)) throw new Error(`Expected skill label, got "${list[i].text}"`);
    const body = list[++i];
    let text = plain(body.text);
    let style;
    if (body.bullet) style = "marker";
    else if (/^•\s/.test(text)) {
      style = "inline";
      text = text.replace(/^•\s*/, "");
    }
    addCategory(plain(label.text), text, style, body.lineTexts);
  }
}

// ---- experience / projects / education -----------------------------------------------------
const experience = [];
{
  const list = sections.experience;
  let cur = null;
  const open = (company, title, dates) => {
    cur = { id: `exp-${slug(company)}`, company, title, location: "", ...parseRange(dates), facts: [] };
    experience.push(cur);
  };
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (p.bullet) {
      cur.facts.push({ id: `fact-${cur.id.replace("exp-", "")}-${cur.facts.length + 1}`, text: p.text.trim() });
      continue;
    }
    if (template === "frontend") {
      open(plain(p.text), plain(list[i + 1].text), plain(list[i + 2].text));
      i += 2;
    } else if (template === "java") {
      const t = plain(p.text);
      const j = t.lastIndexOf(",");
      open(t.slice(j + 1).trim(), t.slice(0, j).trim(), plain(list[i + 1].text));
      i += 1;
    } else if (template === "ror") {
      const t = plain(p.text);
      const j = t.indexOf(",");
      open(t.slice(0, j).trim(), t.slice(j + 1).trim(), plain(list[i + 1].text));
      i += 1;
    } else {
      // mern, python: title bold / company italic / dates
      open(plain(list[i + 1].text), plain(p.text), plain(list[i + 2].text));
      i += 2;
    }
  }
}

/** Link annotations of the reference PDFs (they are not part of the extracted text). */
const PROJECT_LINKS = {
  "Monte Carlo Analytics": "https://main.d1wxfdobtmq35e.amplifyapp.com/",
  Navitus: "https://www.navitus.com/",
  Ehata: "https://ehataview.com/",
};
const projects = [];
{
  let cur = null;
  for (const p of sections.projects) {
    if (p.bullet) {
      cur.facts.push({ id: `fact-${cur.id.replace("proj-", "p-")}-${cur.facts.length + 1}`, text: p.text.trim() });
    } else if (isBold(p) && !p.bullet) {
      cur = { id: `proj-${slug(plain(p.text)).split("-")[0]}`, name: plain(p.text), facts: [] };
      if (PROJECT_LINKS[cur.name]) cur.link = PROJECT_LINKS[cur.name];
      projects.push(cur);
    } else if (template === "mern") {
      sentences(p.text.trim()).forEach((s, i) =>
        cur.facts.push({ id: `fact-${cur.id.replace("proj-", "p-")}-${i + 1}`, text: s }),
      );
    } else {
      cur.tagline = plain(p.text);
    }
  }
}

const education = [];
{
  const l = sections.education;
  for (let i = 0; i < l.length; i += 2) {
    education.push({
      id: "edu-punjab",
      degree: plain(l[i].text).replace(/,$/, ""),
      institution: plain(l[i + 1].text),
      startDate: null,
      endDate: null,
    });
  }
}

// ---- person / summary --------------------------------------------------------------------
const headline = plain(header.find((p) => isItalic(p) || p.size > 10.5 && p.size < 13 && !p.isHeading)?.text ?? "");
const contactText = header.map((p) => plain(p.text)).join(" ");
const allText = paras.map((p) => plain(p.text)).join(" ");
const location = /Lahore, Pakistan/.test(allText) ? "Lahore, Pakistan" : "Pakistan";
const summaryText = plain(sections.summary.map((p) => p.text).join(" "));
const summaryFacts = sentences(summaryText).map((text, i) => ({ id: `summary-${i + 1}`, text }));
if (summaryFacts.map((f) => f.text).join(" ") !== summaryText) throw new Error("summary split lost text");

// ---- tag facts with skill names found in their text -----------------------------------------
const names = [...new Set(skills.map((s) => s.name))];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mentions = (text, name) => new RegExp(`(^|[^A-Za-z0-9+#])${esc(name)}([^A-Za-z0-9+#]|$)`, "i").test(text);
for (const f of [...experience.flatMap((e) => e.facts), ...projects.flatMap((p) => p.facts)]) {
  f.skills = names.filter((n) => mentions(plain(f.text), n));
}

const master = {
  version: 1,
  ...(template === "mern" ? {} : { allowDuplicateSkills: true }),
  person: { ...base.person, defaultHeadline: headline, location, phone: "" },
  summaryFacts,
  skillCategories,
  skills,
  experience,
  projects,
  education,
  certifications: [],
};
void contactText;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(master, null, 2) + "\n");
console.log(
  `${template}: ${skillCategories.length} skill categories, ${skills.length} skills, ${experience.length} roles (${experience.map((e) => e.facts.length).join("/")} bullets), ${projects.length} projects (${projects.map((p) => p.facts.length).join("/")}), headline "${headline}"`,
);
