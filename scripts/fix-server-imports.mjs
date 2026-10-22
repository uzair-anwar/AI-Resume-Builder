import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");

const FIXES = [
  // tailor → ats / resume / ai
  ["lib/server/tailor/tailoring-workspace.ts", [
    ['from "./ats-expansion"', 'from "@/lib/server/ats/ats-expansion"'],
    ['from "./analyze-job"', 'from "@/lib/server/ats/analyze-job"'],
  ]],
  ["lib/server/tailor/step-validators.ts", [
    ['from "./validate-tailoring"', 'from "@/lib/server/resume/validate-tailoring"'],
    ['from "./role-families"', 'from "@/lib/server/ats/role-families"'],
    ['from "./master-resume"', 'from "@/lib/server/resume/master-resume"'],
  ]],
  ["lib/server/tailor/step-coercion.ts", [
    ['from "./role-families"', 'from "@/lib/server/ats/role-families"'],
    ['from "./master-resume"', 'from "@/lib/server/resume/master-resume"'],
    ['from "./text-sanitize"', 'from "@/lib/server/text-sanitize"'],
  ]],
  ["lib/server/tailor/prompts-staged.ts", [
    ['from "./ai/redact"', 'from "@/lib/server/ai/redact"'],
    ['from "./evidence-mapper"', 'from "@/lib/server/ats/evidence-mapper"'],
    ['from "./phrase-coverage"', 'from "@/lib/server/ats/phrase-coverage"'],
    ['from "./role-families"', 'from "@/lib/server/ats/role-families"'],
  ]],
  ["lib/server/tailor/prompt-context.ts", [
    ['from "./ai/redact"', 'from "@/lib/server/ai/redact"'],
    ['from "./ats-expansion"', 'from "@/lib/server/ats/ats-expansion"'],
    ['from "./jd-exact-phrases"', 'from "@/lib/server/ats/jd-exact-phrases"'],
    ['from "./role-families"', 'from "@/lib/server/ats/role-families"'],
  ]],
  ["lib/server/tailor/prompts.ts", [
    ['from "./ai/redact"', 'from "@/lib/server/ai/redact"'],
  ]],
  ["lib/server/tailor/deterministic-tailor.ts", [
    ['from "./ats-score"', 'from "@/lib/server/ats/ats-score"'],
    ['from "./phrase-coverage"', 'from "@/lib/server/ats/phrase-coverage"'],
    ['from "./polish-resume-copy"', 'from "@/lib/server/resume/polish-resume-copy"'],
  ]],
  ["lib/server/tailor/select-facts.ts", [
    ['from "@/lib/shared/relevance"', 'from "@/lib/shared/relevance"'],
  ]],
  ["lib/server/ats/ats-score.ts", [
    ['from "./bullet-metrics"', 'from "@/lib/server/resume/bullet-metrics"'],
  ]],
  ["lib/server/resume/term-synonym-dedupe.ts", [
    ['from "./taxonomy"', 'from "@/lib/server/ats/taxonomy"'],
    ['from "@/lib/term-synonym-dedupe"', 'from "@/lib/shared/term-synonym-dedupe"'],
  ]],
  ["lib/server/resume/bullet-metrics.ts", [
    ['from "./step-validation-helpers"', 'from "@/lib/server/tailor/step-validation-helpers"'],
  ]],
  ["lib/server/resume/validate-tailoring.ts", [
    ['from "./text-sanitize"', 'from "@/lib/server/text-sanitize"'],
  ]],
  ["lib/server/resume/polish-resume-copy.ts", [
    ['from "./term-synonym-dedupe"', 'from "@/lib/server/resume/term-synonym-dedupe"'],
  ]],
];

for (const [rel, pairs] of FIXES) {
  const file = path.join(ROOT, rel);
  let text = fs.readFileSync(file, "utf8");
  for (const [a, b] of pairs) text = text.split(a).join(b);
  fs.writeFileSync(file, text);
}

// tailor-steps pipeline imports
const pipeline = path.join(ROOT, "lib/server/tailor/tailor-steps/pipeline.ts");
let pt = fs.readFileSync(pipeline, "utf8");
pt = pt.replace('from "../project-select"', 'from "@/lib/server/tailor/project-select"');
pt = pt.replace('from "../tailoring-workspace"', 'from "@/lib/server/tailor/tailoring-workspace"');
fs.writeFileSync(pipeline, pt);

const runStep = path.join(ROOT, "lib/server/tailor/tailor-steps/run-step.ts");
let rs = fs.readFileSync(runStep, "utf8");
rs = rs.replace('from "../analyze-job"', 'from "@/lib/server/ats/analyze-job"');
rs = rs.replace('from "../headline-align"', 'from "@/lib/server/ats/headline-align"');
rs = rs.replace('from "../role-families"', 'from "@/lib/server/ats/role-families"');
fs.writeFileSync(runStep, rs);

console.log("Fixed server cross-imports");
