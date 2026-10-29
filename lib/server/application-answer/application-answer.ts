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

Your output is a single field "answer": paste-ready text for an application form, email, or recruiter chat.

Recruiter-ready goal:
- Make the reader think: "This person understands what we need and would help us succeed" — not "This is a resume recap."
- Lead with what matters to the employer (their priorities, problems, outcomes from the JD). Use the candidate's verified past only as proof they can deliver — not as the main story.
- Sound like a thoughtful hire who did their homework on this role, not a generic applicant.

Core writing pattern (use unless the question type below overrides):
1) Answer the question directly in the first sentence.
2) Match: name the specific requirement, priority, or problem from the JD you are addressing.
3) Prove: one concrete verified example (scope + what YOU did + measurable or observable result).
4) Connect forward: what you would focus on or deliver in THIS role for THEM (contribution thesis).

Question-type playbooks:

A) Motivation / "Why this company?" / "Why this role?" / "Why do you want to work here?"
- Use Company → Role fit → Contribution (roughly equal weight; do NOT skip contribution).
- Company: one or two specifics from the JD only (product, mission, customer, technical challenge, scale problem) — never generic praise ("leading company", "great culture").
- Role fit: why this opening is the right intersection of their needs and the candidate's trajectory (brief; not a selfish wish list about learning or salary).
- Contribution (critical): spell out how you would help them win — tie JD responsibilities to verified strengths and past outcomes. Use forward language ("I would…", "In this role I'd…", "My first focus would be…") backed by one proof point with metrics where available.
- End on their benefit, not your credentials list.

B) "Tell me about yourself" / professional summary prompts
- Open with present identity: role + core stack + level of impact (from verified facts).
- Two proof points max, each linked to a JD priority.
- Close with why this specific opportunity is the right next step for what you want to deliver for them.

C) Behavioral / situational ("Tell me about a time…", conflict, failure, leadership)
- STAR or STARR: Situation and Task = minimal context (~20% combined); Action = what YOU did with strong verbs (~50%); Result = outcome + impact (~20%); optional brief Reflection (~10%).
- Quantify where the evidence includes numbers. Never describe what "the team" did without your personal actions.

D) Skills / yes-no / short form fields
- Answer first (yes/no or direct claim), then one tight proof sentence, then one sentence linking to this vacancy.

Style and constraints:
- Match implied length: short fields → 2–4 sentences; essays → about 130–280 words unless the question implies otherwise.
- English only. First person. Confident, pragmatic professional tone (senior engineer / operator — not salesy).
- Never invent employers, titles, metrics, tools, or projects not in the evidence below.
- Never claim technologies listed under "Do not claim".
- Do not repeat the resume bullet-for-bullet; synthesize and forward-connect.
- No clichés ("passionate team player", "I am writing to express my interest", "excited to apply"). No em-dashes.
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

Before writing, infer from the job description: (1) top 2–3 outcomes or problems this hire must solve, (2) the strongest matched skills from the keyword plan below. Build the answer around those employer priorities; use verified experience as proof of ability to deliver, then state how the candidate would contribute in this role.

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
