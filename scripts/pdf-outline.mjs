#!/usr/bin/env node
/**
 * Dev tool: turn a reference PDF into logical paragraphs (wrapped lines joined, bullets detected).
 * Usage: node scripts/pdf-outline.mjs file.pdf --split 297.75 [--json out.json]
 * Output paragraph: { col: 0|1, y, x, font, size, bullet, text }
 */
import { writeFileSync } from "node:fs";
import { extractPdf } from "./pdf-extract.mjs";

const args = process.argv.slice(2);
const file = args[0];
const si = args.indexOf("--split");
const split = si > 0 ? Number(args[si + 1]) : undefined;
const res = await extractPdf(file, split);
const SP = split ?? res.width / 2;

const flags = (font) => ({ b: /Bold/.test(font), i: /Italic/.test(font) });
function markup(l) {
  const runs = l.runs ?? [{ str: l.str, font: l.font }];
  if (runs.length === 1) return l.str;
  // base style = style with most characters
  const tally = {};
  for (const r of runs) {
    const f = flags(r.font);
    const k = `${f.b}|${f.i}`;
    tally[k] = (tally[k] ?? 0) + r.str.trim().length;
  }
  const base = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
  let out = "";
  for (const r of runs) {
    const f = flags(r.font);
    const k = `${f.b}|${f.i}`;
    const t = r.str;
    if (k === base || !t.trim()) out += t;
    else {
      const m = f.b && f.i ? "***" : f.b ? "**" : "*";
      const lead = t.match(/^\s*/)[0];
      const trail = t.match(/\s*$/)[0];
      out += lead + m + t.trim() + m + trail;
    }
  }
  return out;
}
const lines = res.lines.map((l) => ({ ...l, mk: markup(l) }));
const bulletMarks = lines.filter((l) => l.size < 2);
const body = lines.filter((l) => l.size >= 2);

const paras = [];
for (const col of [0, 1]) {
  const L = body.filter((l) => (l.x < SP - 0.5 ? 0 : 1) === col).sort((a, b) => a.y - b.y || a.x - b.x);
  const minX = Math.min(...L.map((l) => l.x));
  let cur = null;
  let prev = null;
  for (const l of L) {
    let isBullet = bulletMarks.some((m) => Math.abs(m.y - l.y) < 0.6 && Math.abs(m.x - l.x) < 1);
    if (/^•\s/.test(l.str) && l.x - minX > 5) {
      isBullet = true;
      l.str = l.str.replace(/^•\s*/, "");
      l.mk = l.mk.replace(/^\*?\*?•\s*/, "");
    }
    const heading = /Bold/.test(l.font) && l.size >= 9.9 && !/\+/.test(l.font);
    const pitch = prev ? l.y - prev.y : 0;
    const sameStyle = prev && prev.size === l.size && (prev.font === l.font || (prev.font.includes("+") && !l.font.includes("+")));
    const isDate = /^(?:\d{2}\/\d{4}|[A-Z][a-z]{2} \d{4}) – /.test(l.str);
    const continues =
      cur && !isDate && !isBullet && !heading && sameStyle && Math.abs(l.x - prev.x) < 1.5 && pitch > 0 && pitch < 12.6 && !cur.isHeading && cur.kind !== "single";
    if (continues) {
      cur.text = (cur.text + (/-$/.test(cur.text) ? "" : " ") + l.mk).replace(/\*\* \*\*/g, " ").replace(/([^*])\* \*([^*])/g, "$1 $2");
      cur.lines++;
      cur.lineTexts.push(l.str);
    } else {
      if (cur) paras.push(cur);
      cur = { col, y: l.y, x: l.x, font: l.font, size: l.size, bullet: isBullet, isHeading: heading, text: l.mk, lines: 1, w: l.w, lineTexts: [l.str] };
    }
    prev = l;
  }
  if (cur) paras.push(cur);
}
const short = (f) => f.replace(/CrimsonText|SourceSansPro|PTSerif|Alegreya|Jost/g, (m) => ({ CrimsonText: "Cr", SourceSansPro: "Ss", PTSerif: "Pt", Alegreya: "Al", Jost: "Jo" })[m]).replace("-Regular", "");
if (args.includes("--json")) writeFileSync(args[args.indexOf("--json") + 1], JSON.stringify(paras, null, 1));
for (const col of [0, 1]) {
  console.log(`===== COLUMN ${col}`);
  for (const p of paras.filter((q) => q.col === col)) {
    console.log(`${String(p.y).padStart(7)} ${p.isHeading ? "H" : p.bullet ? "•" : " "} ${short(p.font).padEnd(12)} ${String(p.size).padEnd(5)}${p.text}`);
  }
}
