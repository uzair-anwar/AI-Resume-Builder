#!/usr/bin/env node
/**
 * Dev tool: compare a generated resume PDF to a reference PDF (text lines + filled rectangles).
 *
 * Usage: node scripts/pdf-compare.mjs reference.pdf generated.pdf [--split 297.75] [--tol 0.6] [--max 40] [--json out.json]
 *
 * Reports lines that are missing, extra or placed differently (x / baseline / width / size / font)
 * and rectangles (rules, heading bars, bullet dots) that differ. Exit code 1 when anything is off.
 */
import { writeFileSync } from "node:fs";
import { extractPdf } from "./pdf-extract.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const [refPath, genPath] = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!refPath || !genPath) {
  console.error("usage: pdf-compare.mjs reference.pdf generated.pdf [--split X] [--tol 0.6] [--max 40]");
  process.exit(2);
}
const split = flag("--split") ? Number(flag("--split")) : undefined;
const tol = Number(flag("--tol", "0.8"));
const maxShow = Number(flag("--max", "40"));

const norm = (s) => s.replace(/\s+/g, " ").replace(/ ,/g, ",").trim();
const fontKey = (f) => f.split("+").sort().join("+");

export function compareExtractions(ref, gen, opts = {}) {
  const t = opts.tol ?? 0.8;
  // FlowCV draws a 0.75pt invisible bullet glyph next to each marker; ignore those.
  ref = { ...ref, lines: ref.lines.filter((l) => l.size >= 2) };
  gen = { ...gen, lines: gen.lines.filter((l) => l.size >= 2) };
  const issues = [];
  const used = new Set();
  const genLines = gen.lines.map((l, i) => ({ ...l, i, key: norm(l.str) }));
  let matched = 0;
  let sumDx = 0;
  let sumDy = 0;
  for (const r of ref.lines) {
    const key = norm(r.str);
    if (!key) continue;
    let best = null;
    let bestD = Infinity;
    for (const g of genLines) {
      if (used.has(g.i) || g.key !== key) continue;
      const d = Math.abs(g.y - r.y) + Math.abs(g.x - r.x);
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    if (!best) {
      issues.push({ kind: "MISSING", ref: r });
      continue;
    }
    used.add(best.i);
    matched++;
    const dx = best.x - r.x;
    const dy = best.y - r.y;
    sumDx += Math.abs(dx);
    sumDy += Math.abs(dy);
    const bad = [];
    if (Math.abs(dx) > t) bad.push(`dx=${dx.toFixed(2)}`);
    if (Math.abs(dy) > t) bad.push(`dy=${dy.toFixed(2)}`);
    if (Math.abs(best.w - r.w) > Math.max(t, r.w * 0.01)) bad.push(`dw=${(best.w - r.w).toFixed(2)}`);
    if (Math.abs(best.size - r.size) > 0.1) bad.push(`size ${r.size}->${best.size}`);
    if (fontKey(best.font) !== fontKey(r.font)) bad.push(`font ${r.font}->${best.font}`);
    if (bad.length) issues.push({ kind: "DIFF", ref: r, gen: best, detail: bad.join(" ") });
  }
  for (const g of genLines) if (!used.has(g.i) && g.key) issues.push({ kind: "EXTRA", gen: g });

  // Rectangles: ignore the page-sized white background rects (w>500 && h>600).
  // Icon internals (vector paths) are drawn differently by each tool; compare dots, rules, bars, bands.
  const keep = (r) => {
    if (r.fill === "#ffffff") return false;
    const dot = Math.abs(r.w - 3) < 0.15 && Math.abs(r.h - 3) < 0.15;
    return dot || r.w >= 10 || r.h >= 10;
  };
  const rr = ref.rects.filter(keep);
  const gr = gen.rects.filter(keep);
  const rused = new Set();
  let rectMatched = 0;
  for (const r of rr) {
    let best = -1;
    let bestD = Infinity;
    gr.forEach((g, i) => {
      if (rused.has(i) || g.fill !== r.fill) return;
      const d = Math.abs(g.x - r.x) + Math.abs(g.y - r.y) + Math.abs(g.w - r.w) + Math.abs(g.h - r.h);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best < 0 || bestD > t * 4) {
      issues.push({ kind: "RECT-MISSING", rect: r, near: best >= 0 ? gr[best] : undefined });
    } else {
      rused.add(best);
      rectMatched++;
    }
  }
  gr.forEach((g, i) => {
    if (!rused.has(i)) issues.push({ kind: "RECT-EXTRA", rect: g });
  });

  return {
    issues,
    stats: {
      refLines: ref.lines.length,
      genLines: gen.lines.length,
      matched,
      meanAbsDx: matched ? sumDx / matched : 0,
      meanAbsDy: matched ? sumDy / matched : 0,
      refRects: rr.length,
      rectMatched,
    },
  };
}

const fmtLine = (l) => `${l.y.toFixed(2)} x=${l.x.toFixed(1)} w=${l.w} ${l.font} ${l.size} "${l.str.slice(0, 60)}"`;
const fmtRect = (r) => `${r.fill} ${r.x},${r.y} ${r.w}x${r.h}`;

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (isMain) {
  const ref = await extractPdf(refPath, split);
  const gen = await extractPdf(genPath, split, { dashIndent: flag("--dash") ? Number(flag("--dash")) : 0 });
  const { issues, stats } = compareExtractions(ref, gen, { tol });
  const sizeNote =
    Math.abs(ref.width - gen.width) > 0.5 || Math.abs(ref.height - gen.height) > 0.5
      ? `  PAGE SIZE ${ref.width}x${ref.height} vs ${gen.width}x${gen.height}`
      : "";
  console.log(
    `lines: ref ${stats.refLines}, gen ${stats.genLines}, matched ${stats.matched} | mean |dx| ${stats.meanAbsDx.toFixed(2)}, |dy| ${stats.meanAbsDy.toFixed(2)} | rects ${stats.rectMatched}/${stats.refRects}${sizeNote}`,
  );
  const counts = {};
  for (const i of issues) counts[i.kind] = (counts[i.kind] ?? 0) + 1;
  console.log("issues:", Object.keys(counts).length ? JSON.stringify(counts) : "none");
  issues.slice(0, maxShow).forEach((i) => {
    if (i.kind === "MISSING") console.log("MISSING   ", fmtLine(i.ref));
    else if (i.kind === "EXTRA") console.log("EXTRA     ", fmtLine(i.gen));
    else if (i.kind === "DIFF") console.log("DIFF      ", i.detail, "|", fmtLine(i.ref));
    else console.log(i.kind.padEnd(10), fmtRect(i.rect), i.near ? `(nearest ${fmtRect(i.near)})` : "");
  });
  if (issues.length > maxShow) console.log(`... ${issues.length - maxShow} more`);
  const jsonOut = flag("--json");
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ stats, issues }, null, 1));
  process.exit(issues.length || sizeNote ? 1 : 0);
}
