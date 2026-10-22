import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");

const REPLACEMENTS = [
  ["@/components/ProfileEditor", "@/components/profile/ProfileEditor"],
  ["@/components/HomeWorkspaceClient", "@/components/tailor/HomeWorkspaceClient"],
  ["@/components/HomeWorkspace", "@/components/tailor/HomeWorkspace"],
  ["@/components/CoverLetterPanel", "@/components/cover-letter/CoverLetterPanel"],
  ["@/components/ResumePdfPanel", "@/components/resume/ResumePdfPanel"],
  ["@/components/ResumeDocument", "@/components/resume/ResumeDocument"],
  ["@/components/ResumeEditor", "@/components/resume/ResumeEditor"],
  ["@/components/TailorProgress", "@/components/tailor/TailorProgress"],
  ["@/components/JdTermChips", "@/components/tailor/JdTermChips"],
  ["@/components/SectionCard", "@/components/ui/SectionCard"],
  ["@/components/PageLoader", "@/components/ui/PageLoader"],
  ["@/components/AppShell", "@/components/ui/AppShell"],

  ["@/lib/server/tailor-steps/", "@/lib/server/tailor/tailor-steps/"],
  ["@/lib/server/step-validation-helpers", "@/lib/server/tailor/step-validation-helpers"],
  ["@/lib/server/step-validators", "@/lib/server/tailor/step-validators"],
  ["@/lib/server/step-coercion", "@/lib/server/tailor/step-coercion"],
  ["@/lib/server/prompts-staged", "@/lib/server/tailor/prompts-staged"],
  ["@/lib/server/prompt-context", "@/lib/server/tailor/prompt-context"],
  ["@/lib/server/tailoring-workspace", "@/lib/server/tailor/tailoring-workspace"],
  ["@/lib/server/deterministic-tailor", "@/lib/server/tailor/deterministic-tailor"],
  ["@/lib/server/tailor-resume", "@/lib/server/tailor/tailor-resume"],
  ["@/lib/server/project-select", "@/lib/server/tailor/project-select"],
  ["@/lib/server/select-facts", "@/lib/server/tailor/select-facts"],
  ["@/lib/server/prompts", "@/lib/server/tailor/prompts"],

  ["@/lib/server/jd-curated-phrases", "@/lib/server/ats/jd-curated-phrases"],
  ["@/lib/server/jd-dynamic-vocab", "@/lib/server/ats/jd-dynamic-vocab"],
  ["@/lib/server/jd-exact-phrases", "@/lib/server/ats/jd-exact-phrases"],
  ["@/lib/server/jd-term-quality", "@/lib/server/ats/jd-term-quality"],
  ["@/lib/server/job-title-detect", "@/lib/server/ats/job-title-detect"],
  ["@/lib/server/headline-align", "@/lib/server/ats/headline-align"],
  ["@/lib/server/profile-vocab", "@/lib/server/ats/profile-vocab"],
  ["@/lib/server/evidence-mapper", "@/lib/server/ats/evidence-mapper"],
  ["@/lib/server/phrase-coverage", "@/lib/server/ats/phrase-coverage"],
  ["@/lib/server/ats-expansion", "@/lib/server/ats/ats-expansion"],
  ["@/lib/server/ats-score", "@/lib/server/ats/ats-score"],
  ["@/lib/server/analyze-job", "@/lib/server/ats/analyze-job"],
  ["@/lib/server/jd-extract", "@/lib/server/ats/jd-extract"],
  ["@/lib/server/role-families", "@/lib/server/ats/role-families"],
  ["@/lib/server/taxonomy", "@/lib/server/ats/taxonomy"],

  ["@/lib/server/validate-tailoring", "@/lib/server/resume/validate-tailoring"],
  ["@/lib/server/polish-resume-copy", "@/lib/server/resume/polish-resume-copy"],
  ["@/lib/server/assemble-resume", "@/lib/server/resume/assemble-resume"],
  ["@/lib/server/master-resume", "@/lib/server/resume/master-resume"],
  ["@/lib/server/bullet-metrics", "@/lib/server/resume/bullet-metrics"],
  ["@/lib/server/term-synonym-dedupe", "@/lib/server/resume/term-synonym-dedupe"],

  ["@/lib/server/cover-letter", "@/lib/server/cover-letter/cover-letter"],
  ["@/lib/server/extract-job", "@/lib/server/job/extract-job"],
  ["@/lib/server/extractors/", "@/lib/server/job/extractors/"],

  ["@/lib/build-default-resume", "@/lib/resume/build-default-resume"],
  ["@/lib/layout/", "@/lib/resume/layout/"],

  ["@/lib/client/merge-resume-contact", "@/lib/client/profile/merge-resume-contact"],
  ["@/lib/client/profile-storage", "@/lib/client/profile/profile-storage"],
  ["@/lib/client/ai-provider-storage", "@/lib/client/ai/ai-provider-storage"],
  ["@/lib/client/ai-model-storage", "@/lib/client/ai/ai-model-storage"],
  ["@/lib/client/model-storage", "@/lib/client/ai/model-storage"],
  ["@/lib/client/use-layout-fonts", "@/lib/client/hooks/use-layout-fonts"],
  ["@/lib/client/session-result", "@/lib/client/session/session-result"],
  ["@/lib/client/session-draft", "@/lib/client/session/session-draft"],
  ["@/lib/client/pipeline-key", "@/lib/client/tailor/pipeline-key"],
  ["@/lib/client/staged-tailor", "@/lib/client/tailor/staged-tailor"],

  ["@/lib/format-headline", "@/lib/shared/format-headline"],
  ["@/lib/text-normalize", "@/lib/shared/text-normalize"],
  ["@/lib/term-synonym-dedupe", "@/lib/shared/term-synonym-dedupe"],
  ["@/lib/api-headers", "@/lib/shared/api-headers"],
  ["@/lib/job-boards", "@/lib/shared/job-boards"],
  ["@/lib/job-title", "@/lib/shared/job-title"],
  ["@/lib/relevance", "@/lib/shared/relevance"],
  ["@/lib/format", "@/lib/shared/format"],
];

const RELATIVE = [
  // tailor-steps used ../ for parent server modules
  ['from "../analyze-job"', 'from "@/lib/server/ats/analyze-job"'],
  ['from "../ats-expansion"', 'from "@/lib/server/ats/ats-expansion"'],
  ['from "../ats-score"', 'from "@/lib/server/ats/ats-score"'],
  ['from "../phrase-coverage"', 'from "@/lib/server/ats/phrase-coverage"'],
  ['from "../headline-align"', 'from "@/lib/server/ats/headline-align"'],
  ['from "../role-families"', 'from "@/lib/server/ats/role-families"'],
  ['from "../validate-tailoring"', 'from "@/lib/server/resume/validate-tailoring"'],
  ['from "../assemble-resume"', 'from "@/lib/server/resume/assemble-resume"'],
  ['from "../deterministic-tailor"', 'from "@/lib/server/tailor/deterministic-tailor"'],
  ['from "../project-select"', 'from "@/lib/server/tailor/project-select"'],
  ['from "../tailoring-workspace"', 'from "@/lib/server/tailor/tailoring-workspace"'],
  ['from "../polish-resume-copy"', 'from "@/lib/server/resume/polish-resume-copy"'],
  ['from "../prompts-staged"', 'from "@/lib/server/tailor/prompts-staged"'],
  ['from "../step-coercion"', 'from "@/lib/server/tailor/step-coercion"'],
  ['from "../step-validators"', 'from "@/lib/server/tailor/step-validators"'],
  ['from "../step-validation-helpers"', 'from "@/lib/server/tailor/step-validation-helpers"'],
  ['from "../master-resume"', 'from "@/lib/server/resume/master-resume"'],
  ['from "./run-step"', 'from "@/lib/server/tailor/tailor-steps/run-step"'],
  ['from "./pipeline"', 'from "@/lib/server/tailor/tailor-steps/pipeline"'],
  ['from "./build-skills"', 'from "@/lib/server/tailor/tailor-steps/build-skills"'],
  ['from "./run-ai-structured"', 'from "@/lib/server/tailor/tailor-steps/run-ai-structured"'],
  ['from "./apply-partial"', 'from "@/lib/server/tailor/tailor-steps/apply-partial"'],
];

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".next" || ent.name === "scripts") continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|md)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

let changed = 0;
for (const file of walk(ROOT)) {
  let text = fs.readFileSync(file, "utf8");
  let next = text;
  for (const [a, b] of REPLACEMENTS) next = next.split(a).join(b);
  for (const [a, b] of RELATIVE) next = next.split(a).join(b);
  if (next !== text) {
    fs.writeFileSync(file, next);
    changed++;
  }
}
console.log(`Updated ${changed} files`);
