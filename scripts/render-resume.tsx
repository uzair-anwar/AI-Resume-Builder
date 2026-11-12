/**
 * Dev tool: render a master resume (default, untailored view) to a PDF in Node.
 * Usage: node scripts/run-ts.mjs scripts/render-resume.tsx --template mern --master data/master-resume.json --out /tmp/out.pdf
 */
import { readFileSync, writeFileSync } from "node:fs";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { MasterResumeSchema } from "@/lib/schemas/resume";
import { buildDefaultResumeView } from "@/lib/resume/build-default-resume";
import { ensureServerFonts } from "@/lib/server/layout-fonts";
import { ResumeDocument } from "@/components/resume/ResumeDocument";
import { limitResumeViewProjects } from "@/lib/shared/limit-resume-projects";
import { getTemplate } from "@/lib/resume/templates/registry";

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(n);
  return i > 0 ? process.argv[i + 1] : d;
};
ensureServerFonts();
const template = getTemplate(arg("--template", "mern"));
const master = MasterResumeSchema.parse(JSON.parse(readFileSync(arg("--master", "data/master-resume.json")!, "utf8")));
const view = limitResumeViewProjects(buildDefaultResumeView(master));
if (process.argv.includes("--match-ref")) {
  view.person = { ...view.person, location: arg("--location", "Pakistan")!, phone: "" };
}
const buf = await renderToBuffer(<ResumeDocument resume={view} templateId={template.id} />);
writeFileSync(arg("--out", "/tmp/rp/out.pdf")!, buf);
console.log("wrote", arg("--out", "/tmp/rp/out.pdf"));
