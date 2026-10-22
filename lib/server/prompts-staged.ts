import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { maxCharsForLines } from "@/lib/layout/budgets";
import { SUMMARY_MAX_LINES } from "@/lib/layout/constants";
import { redactContactDetails } from "./ai/redact";
import { formatFactWithEvidence, planRewriteModes } from "./evidence-mapper";
import { phraseInstructions, planPhrasePlacements } from "./phrase-coverage";
import {
  experienceSystemPrompt,
  formatSkillCandidateList,
  headlineSystemPrompt,
  jobTargetingBlock,
  projectSystemPrompt,
  skillsSystemPrompt,
  summarySystemPrompt,
} from "./prompt-context";
import type { RoleFamily } from "./role-families";
import { skillEvidenceTiers } from "./tailor-steps/build-skills";

export function stagedSystemPrompt(): string {
  return summarySystemPrompt();
}

export {
  experienceSystemPrompt,
  headlineSystemPrompt,
  projectSystemPrompt,
  skillsSystemPrompt,
  summarySystemPrompt,
};

export function summaryUserPrompt(
  jobText: string,
  resume: MasterResume,
  analysis: JobAnalysis,
  family: RoleFamily,
): string {
  const facts = resume.summaryFacts
    .map((f) => formatFactWithEvidence(f, analysis, undefined, redactContactDetails(f.text)))
    .join("\n");
  const tiers = skillEvidenceTiers(resume);
  const hasNumbers = resume.summaryFacts.some((f) => /\d/.test(f.text.replace(/\d\+?\s*years?/i, "")));
  const maxChars = maxCharsForLines(SUMMARY_MAX_LINES);

  return `Write a tailored 3-sentence professional summary for this job application.

Constraints:
- Max ${SUMMARY_MAX_LINES} lines (~${maxChars} characters).
- Synthesize and rephrase the facts below; do not return the raw facts joined by spaces.
- Weave in at least 3 matched/related JD keywords from the ATS Keyword Plan that align with the candidate's verified profile.
- Sentence 1 must name the candidate's PRIMARY stack (strongest evidenced technologies below), then add JD-matched technologies. Never open with "specializing in" a technology listed under "Working knowledge".
- ${hasNumbers ? "Only use numbers that appear in the facts." : "The facts contain no performance metrics: do NOT write any percentages, uptime, latency or other numbers except the years of experience. Describe scope and outcomes in words instead."}

PRIMARY stack (strongly evidenced across roles, lead with these): ${tiers.strong.join(", ") || "see facts"}
Working knowledge (mention only as secondary, never as the specialty): ${tiers.working.join(", ") || "none"}

Verified summary facts (with per-fact JD keyword annotations):
${facts}

${jobTargetingBlock(jobText, analysis, family, resume)}`;
}

export const SUMMARY_JSON_SCHEMA = {
  name: "summary_step",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary"],
    properties: { summary: { type: "string" } },
  },
};

export function experienceUserPrompt(
  jobText: string,
  resume: MasterResume,
  analysis: JobAnalysis,
  experienceId: string,
  family: RoleFamily,
): string {
  const exp = resume.experience.find((e) => e.id === experienceId)!;
  const modes = planRewriteModes(exp.facts, analysis);
  const facts = exp.facts
    .map((f) => {
      const maxL = analysis.lineBudgets.bullets[f.id] ?? 2;
      return formatFactWithEvidence(
        f,
        analysis,
        maxL,
        redactContactDetails(f.text),
        true,
        modes.get(f.id),
      );
    })
    .join("\n");
  const roleLineBudget = exp.facts.reduce(
    (n, f) => n + Math.max(1, Math.ceil(f.text.length / 80)),
    0,
  );
  const minBullets = Math.max(1, exp.facts.length - 1);

  const roleSkills = [
    ...new Set(exp.facts.flatMap((f) => f.skills ?? [])),
  ].slice(0, 15);

  return `Rewrite experience bullets for ${exp.company} using the Google XYZ formula (Accomplished X, measured by Y, by doing Z).

Employer (fixed): ${exp.company}
Title on resume (fixed): ${exp.title}
Dates (fixed): ${exp.startDate} – ${exp.endDate ?? "Present"}

Output & Structural Requirements:
- Return JSON object with "bullets": array of { "text", "sourceFactIds" }.
- Preserve bullet density: return between ${minBullets} and ${exp.facts.length} bullets.
- LENGTH (one-page PDF): each bullet must be 1–2 lines (~90–200 characters). At least half the bullets should be ONE tight line. Vary length (short punchy lines + a few 2-line impact lines). No run-on sentences or comma-stacked keyword lists.
- Every bullet must cite at least one sourceFactId from ${exp.company}.
- Actively weave each fact's [JD keywords to include] and [Terminology bridge] terms into the rewritten bullet text while keeping all metrics exact.
- METRICS: For facts marked [has metrics], lead with the Google XYZ "measured by Y" clause using the exact numbers from the source. Across the full resume, surface at least 5 bullets that contain a verifiable number from their source facts (counts, team size, APIs, years, etc.).
- Follow each fact's "Rewrite:" level. Most bullets should stay close to the original meaning. Only facts tagged "LOW JD overlap" may be fully rewritten (new structure and emphasis, or merged with a sibling fact via several sourceFactIds), and even then only from this role's verified facts and skills: never new tools, employers, scope claims, metrics or outcomes.
- If a fact has no number, describe the scope or outcome the fact already implies in words. Never write a percentage, time or count that is not in the source fact.

${phraseInstructions(exp.facts.map((f) => f.id), planPhrasePlacements(resume, analysis))}

Skills demonstrated in this role: ${roleSkills.join(", ") || "see facts"}

Verified facts for ${exp.company} (with per-fact JD evidence mapping):
${facts}

${jobTargetingBlock(jobText, analysis, family, resume)}`;
}

export const EXPERIENCE_JSON_SCHEMA = {
  name: "experience_step",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["bullets"],
    properties: {
      bullets: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["text", "sourceFactIds"],
          properties: {
            text: { type: "string" },
            sourceFactIds: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  },
};

export function skillsOrderUserPrompt(
  jobText: string,
  resume: MasterResume,
  candidateIds: string[],
  analysis: JobAnalysis,
  family: RoleFamily,
): string {
  const categories = resume.skillCategories
    .map((c) => `${c.id}: ${c.label}`)
    .join("\n");

  return `Reorder skills for maximum ATS match without changing the skill set.

Return:
- "selectedSkillIds": every ID below, each exactly once, most job-relevant first ([JD match] first, then [JD related]).
- "skillCategoryOrder": category IDs ordered with the most job-relevant categories first.

Skill categories:
${categories}

Candidate skills (id: name):
${formatSkillCandidateList(resume, candidateIds, analysis)}

${jobTargetingBlock(jobText, analysis, family, resume)}`;
}

export const SKILLS_JSON_SCHEMA = {
  name: "skills_step",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["selectedSkillIds", "skillCategoryOrder"],
    properties: {
      selectedSkillIds: { type: "array", items: { type: "string" } },
      skillCategoryOrder: { type: "array", items: { type: "string" } },
    },
  },
};

export function projectUserPrompt(
  jobText: string,
  resume: MasterResume,
  projectId: string,
  analysis: JobAnalysis,
  family: RoleFamily,
): string {
  const proj = resume.projects.find((p) => p.id === projectId)!;
  const facts = proj.facts
    .map((f) => formatFactWithEvidence(f, analysis, undefined, redactContactDetails(f.text)))
    .join("\n");
  const maxLines = analysis.lineBudgets.projects[projectId] ?? 5;

  return `Rewrite the project description for ${proj.name} to highlight relevance to the target job.

Project name (fixed): ${proj.name}
${proj.link ? `Link (fixed): ${proj.link}` : ""}

Constraints:
- Single cohesive paragraph, max ~${maxLines} lines (~${maxLines * 95} characters). Prefer 2–3 short sentences over one long paragraph.
- Weave in the [JD keywords to include] and [Terminology bridge] annotations where natural.
- "sourceFactIds" must list the fact IDs used from below.

${phraseInstructions(proj.facts.map((f) => f.id), planPhrasePlacements(resume, analysis))}

Verified project facts (with JD evidence mapping):
${facts}

${jobTargetingBlock(jobText, analysis, family, resume)}`;
}

export const PROJECT_JSON_SCHEMA = {
  name: "project_step",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["description", "sourceFactIds"],
    properties: {
      description: { type: "string" },
      sourceFactIds: { type: "array", items: { type: "string" } },
    },
  },
};

export function headlineUserPrompt(
  jobText: string,
  resume: MasterResume,
  family: RoleFamily,
  summary: string,
  skillNames: string[],
  analysis: JobAnalysis,
): string {
  return `Write the resume headline for this application.

Default headline (keep same seniority level): "${resume.person.defaultHeadline}"
Role-family pattern to adapt: ${family.headlinePattern}
Target job title from JD: ${analysis.detectedTitle ?? analysis.focusLabel}

Verified stacks/skills you may reference:
${skillNames.slice(0, 18).join(", ")}

Tailored summary (for context):
${summary.slice(0, 500)}

Constraints:
- ~65 characters when possible; hard max 115.
- Align role title with the JD while keeping seniority, followed by 2–3 JD-matched skills in parentheses.

${jobTargetingBlock(jobText, analysis, family, resume)}`;
}

export const HEADLINE_JSON_SCHEMA = {
  name: "headline_step",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["headline"],
    properties: { headline: { type: "string" } },
  },
};
