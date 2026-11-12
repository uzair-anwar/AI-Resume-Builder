#!/usr/bin/env node
/**
 * Dev tool: extract text lines (font, size, x, y) and filled rectangles from a PDF's first page.
 * Usage: node scripts/pdf-extract.mjs file.pdf [--json out.json] [--lines]
 */
import { readFileSync, writeFileSync } from "node:fs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

function parseColor(args) {
  if (typeof args[0] === "string") {
    const h = args[0].replace("#", "");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  return [args[0], args[1], args[2]].map((v) => (v <= 1 ? v * 255 : v));
}

const r2 = (n) => Math.round(n * 100) / 100;

function fontLabel(page, fontId) {
  try {
    const f = page.commonObjs.get(fontId);
    return (f?.name ?? fontId).replace(/^[A-Z]{6}\+/, "");
  } catch {
    return fontId;
  }
}

export async function extractPdf(path, splitX, opts = {}) {
  const data = new Uint8Array(readFileSync(path));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: false, disableFontFace: true, fontExtraProperties: true }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const ops = await page.getOperatorList();
  const content = await page.getTextContent({ includeMarkedContent: false });

  const items = [];
  for (const it of content.items) {
    if (!("str" in it) || it.str.trim() === "" || it.str === "-") continue;
    const [a, b, , , e, f] = it.transform;
    const size = Math.hypot(a, b);
    // A dash marker drawn right before its text is merged by pdf.js; split it off (dev comparison only).
    if (opts.dashIndent && /^- \S/.test(it.str)) {
      items.push({
        str: it.str.slice(2),
        x: r2(e + opts.dashIndent),
        y: r2(viewport.height - f),
        w: r2(it.width - opts.dashIndent),
        size: r2(size),
        font: fontLabel(page, it.fontName),
      });
      continue;
    }
    items.push({
      str: it.str,
      x: r2(e),
      y: r2(viewport.height - f),
      w: r2(it.width),
      size: r2(size),
      font: fontLabel(page, it.fontName),
    });
  }

  // Merge items on the same baseline that touch into text runs per "line".
  const groups = [];
  for (const it of items) {
    const side = it.x < (splitX ?? viewport.width / 2) ? 0 : 1;
    let g = groups.find((q) => q.side === side && Math.abs(q.y - it.y) < 0.8 && q.size === it.size);
    if (!g) {
      g = { side, y: it.y, size: it.size, items: [] };
      groups.push(g);
    }
    g.items.push(it);
  }
  const rows = [];
  for (const g of groups) {
    g.items.sort((a, b) => a.x - b.x);
    let cur = null;
    for (const it of g.items) {
      if (cur && it.x - (cur.x + cur.w) < 60 && it.x - (cur.x + cur.w) > -6) {
        const gap = it.x - (cur.x + cur.w);
        if (it.font !== cur.font && !cur.font.includes(it.font) && it.str.trim() !== "") cur.font = cur.font + "+" + it.font;
        const needSpace = gap < -0.5 || gap > it.size * 0.15;
        const sep = needSpace && !cur.str.endsWith(" ") && !it.str.startsWith(" ") ? " " : "";
        cur.runs.push({ str: sep + it.str, font: it.font });
        cur.str += sep + it.str;
        cur.w = r2(Math.max(cur.x + cur.w, it.x + it.w) - cur.x);
      } else {
        if (cur) rows.push(cur);
        cur = { ...it, runs: [{ str: it.str, font: it.font }] };
      }
    }
    if (cur) rows.push(cur);
  }
  for (const r of rows) r.str = r.str.replace(/\s+/g, " ").trim();
  rows.sort((p, q) => p.y - q.y || p.x - q.x);

  // Filled rectangles with colours.
  const rects = [];
  const OPS = pdfjs.OPS;
  let fill = [0, 0, 0];
  let stroke = [0, 0, 0];
  let alpha = 1;
  const stack = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const mul = (m, n) => [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
  let pending = [];
  const hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    if (fn === OPS.save) stack.push({ ctm, fill, stroke, alpha });
    else if (fn === OPS.restore) ({ ctm, fill, stroke, alpha } = stack.pop() ?? { ctm, fill, stroke, alpha });
    else if (fn === OPS.transform) ctm = mul(ctm, args);
    else if (fn === OPS.setGState) {
      for (const [k, v] of args[0] ?? []) if (k === "ca") alpha = v;
    }
    else if (fn === OPS.setFillRGBColor) fill = parseColor(args);
    else if (fn === OPS.setStrokeRGBColor) stroke = parseColor(args);
    else if (fn === OPS.setFillGray) fill = [args[0] * 255, args[0] * 255, args[0] * 255];
    else if (fn === OPS.constructPath) {
      const [paintOp, rawData] = args;
      const data = Array.isArray(rawData) ? rawData[0] : rawData;
      const arr = Array.from(Object.values(data ?? {}));
      const pts = [];
      let di = 0;
      let curves = 0;
      while (di < arr.length) {
        const code = arr[di++];
        if (code === 0 || code === 1) {
          pts.push([arr[di], arr[di + 1]]);
          di += 2;
        } else if (code === 2) {
          pts.push([arr[di + 4], arr[di + 5]]);
          di += 6;
          curves++;
        } else if (code === 3) {
          pts.push([arr[di + 2], arr[di + 3]]);
          di += 4;
          curves++;
        } else if (code === 4) {
          /* close */
        } else break;
      }
      if (paintOp >= 22 && paintOp <= 25 && pts.length) {
        const tp = pts.map(([x, y]) => [
          ctm[0] * x + ctm[2] * y + ctm[4],
          ctm[1] * x + ctm[3] * y + ctm[5],
        ]);
        const xs = tp.map((q) => q[0]);
        const ys = tp.map((q) => q[1]);
        const left = Math.min(...xs);
        const right = Math.max(...xs);
        const bottom = Math.min(...ys);
        const topY = Math.max(...ys);
        if (right - left > 0.2 && topY - bottom > 0.2 && right - left < viewport.width * 1.5) {
          rects.push({
            x: r2(left),
            y: r2(viewport.height - topY),
            w: r2(right - left),
            h: r2(topY - bottom),
            fill: hex(fill) + (alpha < 1 ? `@${r2(alpha)}` : ""),
            ...(curves ? { rounded: true } : {}),
          });
        }
      }
    }
  }

  return { width: r2(viewport.width), height: r2(viewport.height), lines: rows, rects };
}

if (process.argv[1] && process.argv[1].endsWith("pdf-extract.mjs")) {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: pdf-extract.mjs file.pdf [--json out.json]");
    process.exit(1);
  }
  const si = process.argv.indexOf("--split");
  const res = await extractPdf(file, si > 0 ? Number(process.argv[si + 1]) : undefined);
  const jsonIdx = process.argv.indexOf("--json");
  if (jsonIdx > 0) writeFileSync(process.argv[jsonIdx + 1], JSON.stringify(res, null, 2));
  console.log(`page ${res.width}x${res.height}`);
  console.log("--- rects");
  for (const r of res.rects) console.log(`${r.fill} x=${r.x} y=${r.y} w=${r.w} h=${r.h}`);
  console.log("--- lines");
  for (const l of res.lines)
    console.log(`y=${String(l.y).padEnd(7)} x=${String(l.x).padEnd(7)} w=${String(l.w).padEnd(7)} ${l.font} ${l.size}  ${l.str.slice(0, 90)}`);
}
