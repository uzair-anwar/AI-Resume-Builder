import "server-only";
import type { MasterResume, ResumeView } from "@/lib/schemas/resume";
import type { OutreachEmail, OutreachEmailResponse } from "@/lib/schemas/outreach-email";
import { OutreachEmailSchema } from "@/lib/schemas/outreach-email";
import { buildDefaultResumeView } from "@/lib/resume/build-default-resume";
import { analyzeJob } from "@/lib/server/ats/analyze-job";
import { redactContactDetails } from "@/lib/server/ai/redact";
import { detectJobTitle } from "@/lib/server/ats/jd-extract";
import { formatKeywordStrategy, safeJobText } from "@/lib/server/tailor/prompt-context";
import { stripForbiddenTerms } from "@/lib/server/text-sanitize";
import {
  outreachBodyQualityIssues,
  sanitizeOutreachBody,
} from "@/lib/server/outreach-email/outreach-body-quality";
import {
  runStructuredAiCall,
  type TailorAiOptions,
} from "@/lib/server/tailor/tailor-steps/run-ai-structured";
import { formatPlainEmailBody } from "@/lib/shared/email-body-format";
import { normalizeTypography as nt } from "@/lib/shared/text-normalize";
import { detectCompanyName } from "@/lib/server/cover-letter/cover-letter";
import type { JobAnalysis } from "@/lib/schemas/tailoring";

export const OUTREACH_EMAIL_JSON_SCHEMA = {
  name: "outreach_email",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["companyName", "roleTitle", "subject", "body"],
    properties: {
      companyName: { type: "string" },
      roleTitle: { type: "string" },
      subject: { type: "string" },
      body: { type: "string" },
    },
  },
};

function companyNameKnown(name: string): boolean {
  const t = name.trim();
  return t.length > 0 && t !== "Hiring Team" && t.toLowerCase() !== "unknown";
}

function resolveCompanyName(jobText: string, analysis: JobAnalysis): string {
  const detected = detectCompanyName(jobText);
  if (companyNameKnown(detected)) return detected;
  const fromJd = analysis.hiringCompanyNames?.[0]?.trim();
  if (fromJd && fromJd.length >= 2 && fromJd.length <= 48) return fromJd;
  return "Hiring Team";
}

function jdStackHook(analysis: JobAnalysis, max = 3): string {
  const picks = analysis.terms
    .filter((t) => t.status === "matched" || t.status === "related")
    .slice(0, max)
    .map((t) => t.surfaceForms?.[0] ?? t.term);
  return picks.length ? picks.join(", ") : analysis.focusLabel;
}

function topSkillLine(view: ResumeView, max = 4): string {
  return view.skills
    .flatMap((c) => c.items.map((i) => i.name))
    .slice(0, max)
    .join(", ");
}

function buildSubjectLine(roleTitle: string, candidateName: string, skills: string): string {
  const stack = skills
    .split(", ")
    .slice(0, 2)
    .join(" · ");
  const withStack = stack ? `${roleTitle}: ${candidateName}, ${stack}` : `${roleTitle}: ${candidateName}`;
  if (withStack.length <= 58) return withStack;
  return `${roleTitle}: ${candidateName}`;
}

/** Keeps copy human and fixes placeholder company names in model output. */
function polishOutreachCopy(email: OutreachEmail): OutreachEmail {
  let { companyName, subject, body } = email;
  if (!companyNameKnown(companyName)) {
    companyName = "Hiring Team";
    body = body
      .replace(/\b(?:at|for|with)\s+Hiring Team\b/gi, "on your team")
      .replace(/\bthe Hiring Team\b/gi, "your team")
      .replace(/\bHiring Team's\b/gi, "your")
      .replace(/\brole at Hiring Team\b/gi, "role");
    subject = subject.replace(/\b[-–—]\s*Hiring Team\b/gi, "").trim();
  }
  subject = subject.replace(/^(Application|Resume|Job application):?\s*/i, "");
  body = formatPlainEmailBody(body);
  return { ...email, companyName, subject, body };
}

function outreachEmailSystemPrompt(): string {
  return `You write a single cold outreach / job-application email for a senior software engineer. Style follows what candidates on Reddit and hiring blogs report works: short, specific, skimmable, sounds human in Gmail (not a cover letter).

Output JSON:
- "companyName": employer from the JD when clear; otherwise "Unknown" (never use "Hiring Team" as a company name).
- "roleTitle": title as written in the JD when possible.
- "subject": under 50 characters when possible, max 60. Formula: exact role title, candidate full name, one proof anchor (core stack or years). Examples: "Full Stack Engineer: Alex Kim, React · Node" or "Backend Engineer: Sam Lee, 6 yrs Java". Never start with "Application", "Resume", or "Job application".
- "body": 90–150 words, 5–7 sentences, ready to paste into Gmail. Use real newline characters in JSON: blank line after greeting, between each paragraph, and before the sign-off (e.g. "Hi Sarah,\\n\\nFirst paragraph...\\n\\nBest,\\nName"). Never one single unbroken line.

Body structure:
1) Greeting: "Hi {FirstName}," if recipient name provided; else "Hi {Company} team," if company known; else "Hello,".
2) Hook (1 sentence): cite ONE specific thing from the JD (stack, product domain, scale, or team mission). No generic "I'm interested" or "lines up with what you're building".
3) Proof (2 sentences OR 2 micro-bullets): what they built, for whom, in which stack; hardest problem + verified metric from evidence only.
4) CTA (1 sentence): low-friction ask, e.g. 15-minute chat, or ask who owns hiring if recipient may not be the HM. Mention resume is attached (PDF added separately).
5) Sign off: "Best," or "Thanks," then candidate full name.

Banned phrases (never use): "I am writing to express", "passionate", "team player", "believe my background lines up", "attached my resume for this opening", "what you're building" without naming something from the JD.

Rules:
- English only. Ground only in verified resume evidence; never invent employers, metrics, or skills.
- No em-dashes. Do not put the recipient's email in the body.
- Never write "Hiring Team" or "Unknown" as an employer inside the body.
- Never paste job-board URLs, GitHub paths, or text like "com/company/repo" — refer to the employer by plain name only (e.g. "Keygate"), not links.
- Every paragraph must be complete sentences. The line after the greeting must be a full opener (not a URL fragment or parenthesis).`;
}

function outreachEmailUserPrompt(
  jobText: string,
  resume: MasterResume,
  view: ResumeView,
  recipientName?: string,
  jobTitleHint?: string,
): string {
  const analysis = analyzeJob(jobText, resume);
  const companyGuess = resolveCompanyName(jobText, analysis);
  const roleGuess =
    jobTitleHint?.trim() || analysis.detectedTitle || detectJobTitle(jobText) || view.headline;

  const expBlock = view.experience
    .slice(0, 2)
    .map(
      (e) =>
        `${e.title} at ${e.company}:\n` +
        e.bullets.slice(0, 2).map((b) => `  - ${redactContactDetails(b.text)}`).join("\n"),
    )
    .join("\n\n");

  const skills = topSkillLine(view, 12);
  const jdHook = jdStackHook(analysis);

  return `Write the cold application email for ${resume.person.name}.

Recipient name (for greeting): ${recipientName?.trim() || "(not provided — use Hello, or Hi {Company} team if company is known)"}
Company (for greeting only; if "Hiring Team" below, company is unknown — do not name an employer in the body): ${
    companyNameKnown(companyGuess) ? companyGuess : "unknown"
  }
Role: ${roleGuess}
JD hook ideas (pick one real detail): ${jdHook}
Candidate headline: ${view.headline}

Summary:
${redactContactDetails(view.summary)}

Top skills: ${skills}

Recent highlights:
${expBlock}

${formatKeywordStrategy(analysis)}

<<<JOB_DESCRIPTION>>>
${safeJobText(jobText)}
<<<END_JOB_DESCRIPTION>>>`;
}

export function buildDeterministicOutreachEmail(
  resume: MasterResume,
  view: ResumeView,
  jobText: string,
  recipientName?: string,
  jobTitleHint?: string,
): OutreachEmail {
  const analysis = analyzeJob(jobText, resume);
  const companyName = resolveCompanyName(jobText, analysis);
  const roleTitle =
    jobTitleHint?.trim() ||
    analysis.detectedTitle ||
    detectJobTitle(jobText) ||
    view.headline.split("|")[0]?.trim() ||
    view.headline;

  const skills = topSkillLine(view);
  const jdFocus = jdStackHook(analysis);
  const exp0 = view.experience[0];
  const b1 = exp0?.bullets[0]?.text ?? view.summary;
  const b2 = exp0?.bullets[1]?.text;

  const greet = recipientName?.trim()
    ? `Hi ${recipientName.trim()},`
    : companyNameKnown(companyName)
      ? `Hi ${companyName} team,`
      : "Hello,";

  const roleLead = companyNameKnown(companyName)
    ? `I saw your ${roleTitle} opening at ${companyName}`
    : `I saw your posting for a ${roleTitle}`;

  const proof =
    exp0 != null
      ? `At ${exp0.company}, I ${redactContactDetails(b1.charAt(0).toLowerCase() + b1.slice(1))}${
          b2
            ? ` I also ${redactContactDetails(b2.charAt(0).toLowerCase() + b2.slice(1))}`
            : ""
        }`
      : redactContactDetails(b1);

  const body = `${greet}

${roleLead}. The focus on ${jdFocus} matches the production work I've been doing with ${skills}.

${proof}

Resume is attached. Would you be open to a 15-minute call this week, or is there someone else I should reach for this search?

Best,
${resume.person.name}`;

  const email: OutreachEmail = {
    companyName,
    roleTitle,
    subject: buildSubjectLine(roleTitle, resume.person.name, skills),
    body,
  };
  return polishOutreachCopy(email);
}

export async function generateOutreachEmail(
  resume: MasterResume,
  jobText: string,
  ai: TailorAiOptions = {},
  tailoredView?: ResumeView,
  jobTitleHint?: string,
  recipientName?: string,
): Promise<OutreachEmailResponse> {
  const view = tailoredView ?? buildDefaultResumeView(resume);
  const analysis = analyzeJob(jobText, resume);
  const warnings: string[] = [];

  const result = await runStructuredAiCall<OutreachEmail>({
    ai,
    messages: [
      { role: "system", content: outreachEmailSystemPrompt() },
      {
        role: "user",
        content: outreachEmailUserPrompt(jobText, resume, view, recipientName, jobTitleHint),
      },
    ],
    jsonSchema: OUTREACH_EMAIL_JSON_SCHEMA,
    maxTokens: 1200,
    validate: (raw) => {
      const parsed = OutreachEmailSchema.safeParse(raw);
      if (!parsed.success) {
        return {
          ok: false,
          issues: [{ code: "SCHEMA", message: parsed.error.message.slice(0, 300) }],
        };
      }
      const d = parsed.data;
      const rawCompany = nt(d.companyName);
      const cleaned: OutreachEmail = polishOutreachCopy({
        companyName: companyNameKnown(rawCompany) ? rawCompany : "Hiring Team",
        roleTitle: nt(d.roleTitle),
        subject: stripForbiddenTerms(nt(d.subject), analysis),
        body: sanitizeOutreachBody(nt(d.body)),
      });
      const bodyIssues = outreachBodyQualityIssues(cleaned.body, resume.person.name);
      if (bodyIssues.length) {
        return { ok: false, issues: bodyIssues };
      }
      return { ok: true, data: cleaned };
    },
  });

  if (result.ok) {
    return { email: result.data, aiUsage: result.aiUsage, usedFallback: false, warnings };
  }

  warnings.push("Used template email from your resume (AI unavailable).");
  return {
    email: buildDeterministicOutreachEmail(resume, view, jobText, recipientName, jobTitleHint),
    aiUsage: result.aiUsage,
    usedFallback: true,
    warnings,
  };
}
