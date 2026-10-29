import "server-only";
import type { MasterResume, ResumeView } from "@/lib/schemas/resume";
import type {
  ApplicationAnswer,
  ApplicationAnswerResponse,
} from "@/lib/schemas/application-answer";
import { ApplicationAnswerSchema } from "@/lib/schemas/application-answer";
import { buildDefaultResumeView } from "@/lib/resume/build-default-resume";
import { analyzeJob } from "@/lib/server/ats/analyze-job";
import { redactContactDetails } from "@/lib/server/ai/redact";
import { detectJobTitle } from "@/lib/server/ats/jd-extract";
import { formatKeywordStrategy, safeJobText } from "@/lib/server/tailor/prompt-context";
import { detectRoleFamily } from "@/lib/server/ats/role-families";
import { stripForbiddenTerms } from "@/lib/server/text-sanitize";
import {
  runStructuredAiCall,
  type TailorAiOptions,
} from "@/lib/server/tailor/tailor-steps/run-ai-structured";
import { normalizeTypography as nt } from "@/lib/shared/text-normalize";
import { detectCompanyName } from "@/lib/server/cover-letter/cover-letter";

export const APPLICATION_ANSWER_JSON_SCHEMA = {
  name: "application_question_answer",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["answer"],
    properties: {
      answer: { type: "string" },
    },
  },
};

function applicationAnswerSystemPrompt(): string {
  return `You are an elite Executive Career Coach helping a candidate answer ONE job application or screening question.

Your output is a single field "answer": the exact text the candidate can paste into an application form, email, or chat with a recruiter.

How to write the answer:
- Answer ONLY the question asked — do not drift into a generic cover letter.
- For behavioral or situational questions (conflict, failure, leadership, "tell me about a time…"), use STAR (Situation, Task, Action, Result) with concrete verified facts.
- For motivation questions ("Why this company?", "Why this role?"), tie specific JD requirements and company context to the candidate's verified stack and achievements — no generic enthusiasm.
- For "Tell me about yourself" / summary prompts, lead with role + years + core stack, then 2–3 proof points mapped to this JD.
- Match the implied length: short text fields → 2–4 tight sentences; essay prompts → about 120–280 words unless the question specifies a limit.
- Write in clear professional English only (translate JD terms if needed). First person. Confident senior engineer tone.
- Never invent employers, titles, metrics, tools, or projects not in the evidence below.
- Never claim technologies listed under "Do not claim".
- No clichés ("passionate team player", "I am writing to express my interest"). No em-dashes.
- Output valid JSON only: {"answer":"..."}`;
}

function applicationAnswerUserPrompt(
  question: string,
  jobText: string,
  resume: MasterResume,
  view: ResumeView,
  jobTitleHint?: string,
): string {
  const analysis = analyzeJob(jobText, resume);
  const family = detectRoleFamily(jobText);
  const companyGuess = detectCompanyName(jobText);
  const roleGuess =
    jobTitleHint?.trim() || analysis.detectedTitle || detectJobTitle(jobText) || family.label;

  const expBlock = view.experience
    .map(
      (e) =>
        `${e.title} at ${e.company} (${e.startDate} – ${e.endDate ?? "Present"}):\n` +
        e.bullets.map((b) => `  - ${redactContactDetails(b.text)}`).join("\n"),
    )
    .join("\n\n");

  const projBlock = view.projects
    .map((p) => `${p.name}: ${redactContactDetails(p.description)}`)
    .join("\n");

  const skillsFlat = view.skills
    .flatMap((c) => c.items.map((i) => i.name))
    .slice(0, 25)
    .join(", ");

  return `Candidate: ${resume.person.name}
Headline: ${view.headline}
Target role: ${roleGuess}
Company (from JD — refine if obvious): ${companyGuess}

<<<APPLICATION_QUESTION>>>
${redactContactDetails(question.trim())}
<<<END_APPLICATION_QUESTION>>>

Tailored summary:
${redactContactDetails(view.summary)}

Verified skills:
${skillsFlat}

Verified experience:
${expBlock}

Verified projects:
${projBlock}

${formatKeywordStrategy(analysis)}

<<<JOB_DESCRIPTION>>>
${safeJobText(jobText)}
<<<END_JOB_DESCRIPTION>>>`;
}

export async function generateApplicationAnswer(
  question: string,
  resume: MasterResume,
  jobText: string,
  ai: TailorAiOptions = {},
  tailoredView?: ResumeView,
  jobTitleHint?: string,
): Promise<ApplicationAnswerResponse> {
  const view = tailoredView ?? buildDefaultResumeView(resume);
  const analysis = analyzeJob(jobText, resume);
  const warnings: string[] = [];
  const trimmedQuestion = question.trim();

  const result = await runStructuredAiCall<ApplicationAnswer>({
    ai,
    messages: [
      { role: "system", content: applicationAnswerSystemPrompt() },
      {
        role: "user",
        content: applicationAnswerUserPrompt(trimmedQuestion, jobText, resume, view, jobTitleHint),
      },
    ],
    jsonSchema: APPLICATION_ANSWER_JSON_SCHEMA,
    maxTokens: 1200,
    validate: (raw) => {
      const parsed = ApplicationAnswerSchema.safeParse(raw);
      if (!parsed.success) {
        return {
          ok: false,
          issues: [{ code: "SCHEMA", message: parsed.error.message.slice(0, 300) }],
        };
      }
      const answer = stripForbiddenTerms(nt(parsed.data.answer), analysis);
      if (answer.length < 40) {
        return {
          ok: false,
          issues: [{ code: "TOO_SHORT", message: "Answer too short" }],
        };
      }
      return { ok: true, data: { answer } };
    },
  });

  if (!result.ok) {
    throw new Error(
      result.message ??
        result.issues[0]?.message ??
        "Could not generate an answer. Check your AI provider settings and try again.",
    );
  }

  return {
    question: trimmedQuestion,
    answer: result.data.answer,
    aiUsage: result.aiUsage,
    warnings,
  };
}
