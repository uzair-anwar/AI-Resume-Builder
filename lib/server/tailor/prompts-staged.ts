import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { maxCharsForLines } from "@/lib/resume/layout/budgets";
import { SUMMARY_MAX_LINES } from "@/lib/resume/layout/constants";
import { redactContactDetails } from "@/lib/server/ai/redact";
import { formatFactWithEvidence, planRewriteModes } from "@/lib/server/ats/evidence-mapper";
import { phraseInstructions, planPhrasePlacements } from "@/lib/server/ats/phrase-coverage";
import {
  experienceSystemPrompt,
  formatSkillCandidateList,
  headlineSystemPrompt,
  jobTargetingBlock,
  projectSystemPrompt,
  skillsSystemPrompt,
  summarySystemPrompt,
} from "./prompt-context";
import type { RoleFamily } from "@/lib/server/ats/role-families";
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
- Weave in JD keywords from the ATS Keyword Plan and EXACT JOB DESCRIPTION WORDING block — use the same spelling as the job description (summary counts for soft skills like communication, teamwork, analytical skills).
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

  const metricFactIds = exp.facts
    .filter((f) => /\d/.test(f.text))
    .map((f) => f.id);
  const metricTarget = metricFactIds.length
    ? Math.max(1, Math.ceil(exp.facts.length / 2))
    : 0;

  return `Rewrite experience bullets for ${exp.company} using the Google XYZ formula (Accomplished X, measured by Y, by doing Z).

Employer (fixed): ${exp.company}
Title on resume (fixed): ${exp.title}
Dates (fixed): ${exp.startDate} – ${exp.endDate ?? "Present"}

Output & Structural Requirements:
- Return JSON object with "bullets": array of { "text", "sourceFactIds" }.
- Preserve bullet density: return between ${minBullets} and ${exp.facts.length} bullets.
- LENGTH (one-page PDF): each bullet should be 2–3 lines (~130–280 characters) so JD hard/soft skills appear in the bullet text itself. Write complete sentences that end with proper punctuation — never stop mid-phrase. If a bullet wraps to two lines, avoid a single-word second line (add a few more words or tighten to one line).
- Every bullet must cite at least one sourceFactId from ${exp.company}.
- Actively weave each fact's [JD keywords to include] and [Terminology bridge] terms into the rewritten bullet text while keeping all metrics exact.
- METRICS: Facts with numbers in this role: ${metricFactIds.length ? metricFactIds.join(", ") : "none"}. ${
    metricTarget
      ? `Include a verifiable number in at least ${metricTarget} bullets for this employer (copy counts exactly from the citing source fact).`
      : "No numeric facts in this role — describe scope in words only."
  } For facts marked [REQUIRED METRIC], the bullet must contain every digit from that source fact.
- OPENINGS: Use a different past-tense verb to start each bullet in this role (Built, Engineered, Integrated, Mentored, …) — never repeat the same first verb twice.
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
- Single cohesive paragraph, max ~${maxLines} lines (~${maxLines * 110} characters). Use 3–4 complete sentences ending with periods; never truncate mid-sentence. Weave JD keywords into the narrative (not a list).
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
- Headline = ONE short role title only: 3–6 words (e.g. "Senior Forward Deployed Engineer", "Senior Full Stack Developer", "Senior Software Engineer"). Use Target job title from JD when it is a real role — NEVER use JD section headers like "What you will do", "Responsibilities", or "Requirements".
- Optional: at most ONE short parenthetical with 1–2 stack keywords (e.g. "(AI · Full Stack)"). Hard max 115 characters total.
- Do NOT list soft skills or long keyword chains in the headline; put those in summary and bullets.

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
