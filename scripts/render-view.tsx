/**
 * Dev tool: render a tailored ResumeView (JSON from /api/tailor, `{ resume }` or the view itself) to a PDF.
 * Usage: node scripts/run-ts.mjs scripts/render-view.tsx --view out.json --template java --out /tmp/out.pdf
 */
import { readFileSync, writeFileSync } from "node:fs";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { ensureServerFonts } from "@/lib/server/layout-fonts";
import { ResumeDocument } from "@/components/resume/ResumeDocument";
import { getTemplate } from "@/lib/resume/templates/registry";
import { setActiveProfile } from "@/lib/resume/layout/profile";

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(n);
  return i > 0 ? process.argv[i + 1] : d;
};
ensureServerFonts();
const template = getTemplate(arg("--template", "mern"));
setActiveProfile(template.profile);
const json = JSON.parse(readFileSync(arg("--view")!, "utf8"));
const view = json.resume ?? json;
const buf = await renderToBuffer(<ResumeDocument resume={view} templateId={template.id} />);
writeFileSync(arg("--out", "/tmp/out.pdf")!, buf);
console.log("wrote", arg("--out", "/tmp/out.pdf"));
