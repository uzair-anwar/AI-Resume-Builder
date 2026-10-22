import "server-only";
import type { MasterResume, ResumeView } from "@/lib/schemas/resume";
import type {
  CoverLetterResponse,
  CoverLetterVariants,
} from "@/lib/schemas/cover-letter";
import { CoverLetterVariantsSchema } from "@/lib/schemas/cover-letter";
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

export const COVER_LETTER_JSON_SCHEMA = {
  name: "cover_letter_variants",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["companyName", "roleTitle", "standard", "shortMessage", "talkingPoints"],
    properties: {
      companyName: { type: "string" },
      roleTitle: { type: "string" },
      standard: { type: "string" },
      shortMessage: { type: "string" },
      talkingPoints: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
};

export function detectCompanyName(jobText: string): string {
  const patterns = [
    /^about\s+([A-Z][A-Za-z0-9.& -]{1,40})$/im,
    /\bat\s+([A-Z][A-Za-z0-9.&-]{2,35}),?\s+we\s+(?:are|build|help|believe|power)/i,
    /([A-Z][A-Za-z0-9.&-]{2,35})\s+is\s+(?:building|hiring|looking\s+for|seeking|a\s+leading)/,
    /company\s*:\s*([A-Z][A-Za-z0-9.& -]{1,40})/i,
  ];
  for (const re of patterns) {
    const m = re.exec(jobText);
    if (m?.[1]) {
      const cleaned = m[1].trim().replace(/[.,:;]+$/, "");
      if (cleaned.length >= 2 && cleaned.length <= 40) return cleaned;
    }
  }
  return "Hiring Team";
}

function coverLetterSystemPrompt(): string {
  return `You are an elite Executive Career Coach and Technical Copywriter modeled after the ats-resume-tailor Cover Writer agent.

Your task: generate 3 grounded, high-converting cover letter / outreach variants for the target job using ONLY the candidate's verified achievements, metrics, and skills.

Variants to generate in JSON:
1. "standard" (240–320 words):
   - Paragraph 1 (Hook): Express specific interest in the role and company mission from the JD, positioning the candidate's seniority and core stack.
   - Paragraph 2 (Core Engineering Proof): Connect 2 concrete achievements (with verified metrics and employers) directly to the JD's top technical requirements.
   - Paragraph 3 (Architecture, Reliability & Collaboration): Highlight system design, project delivery, or leadership alignment, followed by a confident call to action.
   - Sign off with the candidate's name. Use newline breaks between paragraphs.
2. "shortMessage" (95–145 words):
   - Concise, high-signal direct message ideal for Wellfound "Note to hiring manager", LinkedIn InMail, Y Combinator Work at a Startup, or cold email.
   - Immediately leads with matched stack + 1–2 standout metrics + why their product/engineering challenge resonates.
3. "talkingPoints" (4–6 bullets):
   - First-person or crisp pitch points ("Why me for this role") mapping specific JD requirements to the candidate's proven track record.

Strict Grounding Rules:
- Never invent employers, titles, metrics, or skills not in the provided candidate evidence.
- Never claim technologies listed under "Do not claim".
- No generic clichés ("I am writing to express my strong interest", "passionate team player"). Write like a pragmatic senior engineer speaking to a VP of Engineering or Founder.
- Do not use em-dashes. Output valid JSON only.`;
}

function coverLetterUserPrompt(
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

  return `Generate the 3 cover letter variants for ${resume.person.name}.

Candidate Name: ${resume.person.name}
Candidate Headline: ${view.headline}
Detected Company Name (refine if clear in JD): ${companyGuess}
Target Role Title: ${roleGuess}

Tailored Summary:
${redactContactDetails(view.summary)}

Verified Top Skills:
${skillsFlat}

Verified Experience Highlights:
${expBlock}

Verified Projects:
${projBlock}

${formatKeywordStrategy(analysis)}

<<<JOB_DESCRIPTION>>>
${safeJobText(jobText)}
<<<END_JOB_DESCRIPTION>>>`;
}

export function buildDeterministicCoverLetter(
  resume: MasterResume,
  view: ResumeView,
  jobText: string,
  jobTitleHint?: string,
): CoverLetterVariants {
  const analysis = analyzeJob(jobText, resume);
  const companyName = detectCompanyName(jobText);
  const roleTitle =
    jobTitleHint?.trim() ||
    analysis.detectedTitle ||
    detectJobTitle(jobText) ||
    view.headline.split("(")[0].trim();

  const topSkills = view.skills
    .flatMap((c) => c.items.map((i) => i.name))
    .slice(0, 6)
    .join(", ");

  const firstExp = view.experience[0];
  const secondExp = view.experience[1];
  const b1 = firstExp?.bullets[0]?.text ?? view.summary;
  const b2 = secondExp?.bullets[0]?.text ?? firstExp?.bullets[1]?.text ?? "";

  const salutation =
    companyName && companyName !== "Hiring Team"
      ? `Dear ${companyName} Engineering Team,`
      : "Dear Hiring Team,";

  const standard = [
    salutation,
    `As a ${view.headline} with deep hands-on experience in ${topSkills}, I am excited to apply for the ${roleTitle} role${companyName !== "Hiring Team" ? ` at ${companyName}` : ""}. ${view.summary}`,
    firstExp
      ? `In my role as ${firstExp.title} at ${firstExp.company}, I focused on building reliable, scalable production systems: ${b1}${b2 ? ` Additionally, ${b2.charAt(0).toLowerCase()}${b2.slice(1)}` : ""}`
      : b1,
    `I would welcome the opportunity to bring this focus on clean architecture, reliability, and fast execution to ${companyName !== "Hiring Team" ? companyName : "your team"}. Thank you for your time and consideration.`,
    `Best regards,\n${resume.person.name}`,
  ].join("\n\n");

  const shortMessage = `Hi ${companyName !== "Hiring Team" ? `${companyName} team` : "there"} — I'm ${resume.person.name}, a ${view.headline} experienced with ${topSkills}. Recently at ${firstExp?.company ?? "my current role"}, I ${b1.charAt(0).toLowerCase()}${b1.slice(1)} I'd love to bring this background to the ${roleTitle} role and help scale your platform.`;

  const talkingPoints = [
    `Core Stack Match: Production experience across ${topSkills} aligned with ${roleTitle}.`,
    firstExp ? `${firstExp.company} Impact: ${b1}` : `Summary: ${view.summary}`,
    ...(b2 ? [`Proven Delivery: ${b2}`] : []),
    ...(view.projects[0]
      ? [`Project Highlight (${view.projects[0].name}): ${view.projects[0].description}`]
      : []),
  ].slice(0, 5);

  return {
    companyName,
    roleTitle,
    standard,
    shortMessage,
    talkingPoints,
  };
}

export async function generateCoverLetter(
  resume: MasterResume,
  jobText: string,
  ai: TailorAiOptions = {},
  tailoredView?: ResumeView,
  jobTitleHint?: string,
): Promise<CoverLetterResponse> {
  const view = tailoredView ?? buildDefaultResumeView(resume);
  const analysis = analyzeJob(jobText, resume);
  const warnings: string[] = [];

  const result = await runStructuredAiCall<CoverLetterVariants>({
    ai,
    messages: [
      { role: "system", content: coverLetterSystemPrompt() },
      { role: "user", content: coverLetterUserPrompt(jobText, resume, view, jobTitleHint) },
    ],
    jsonSchema: COVER_LETTER_JSON_SCHEMA,
    maxTokens: 1400,
    validate: (raw) => {
      const parsed = CoverLetterVariantsSchema.safeParse(raw);
      if (!parsed.success) {
        return {
          ok: false,
          issues: [{ code: "SCHEMA", message: parsed.error.message.slice(0, 300) }],
        };
      }
      const d = parsed.data;
      const cleaned: CoverLetterVariants = {
        companyName: nt(d.companyName),
        roleTitle: nt(d.roleTitle),
        standard: stripForbiddenTerms(nt(d.standard), analysis),
        shortMessage: stripForbiddenTerms(nt(d.shortMessage), analysis),
        talkingPoints: d.talkingPoints.map((p) => stripForbiddenTerms(nt(p), analysis)),
      };
      return { ok: true, data: cleaned };
    },
  });

  if (result.ok) {
    return {
      coverLetter: result.data,
      aiUsage: result.aiUsage,
      usedFallback: false,
      warnings,
    };
  }

  warnings.push("Generated structured cover letter from tailored resume facts (AI unavailable).");
  return {
    coverLetter: buildDeterministicCoverLetter(resume, view, jobText, jobTitleHint),
    aiUsage: result.aiUsage,
    usedFallback: true,
    warnings,
  };
}
