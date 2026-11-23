import { formatPlainEmailBody } from "@/lib/shared/email-body-format";

/** Outreach is not ATS text — keep paragraphs, drop URL junk, do not strip JD keywords. */
export function sanitizeOutreachBody(body: string): string {
  let t = body.trim();
  t = t.replace(/https?:\/\/\S+/gi, "");
  t = t.replace(/\b[\w.-]+\.(com|io|dev|co|org|net|app)\/[^\s)>]+/gi, "");
  t = t.replace(/\b(?:com|io|dev|co|org|net|app)\/[^\s)>]+/gi, "");
  t = t.replace(/\(\s*\)/g, "");
  t = t.replace(/^\s*\)\s*/gm, "");
  t = t.split("\n").map((line) => line.replace(/^\s*and\s+(?=[a-z])/i, "I ")).join("\n");
  t = t.replace(/[ \t]+\n/g, "\n");
  t = t.replace(/\n[ \t]+/g, "\n");
  t = t.replace(/[ \t]{2,}/g, " ");
  t = t.replace(/\s+([,.!?])/g, "$1");
  return formatPlainEmailBody(t);
}

export type OutreachBodyQualityIssue = { code: string; message: string };

export function outreachBodyQualityIssues(
  body: string,
  candidateName: string,
): OutreachBodyQualityIssue[] {
  const issues: OutreachBodyQualityIssue[] = [];
  const t = body.trim();
  const first = candidateName.trim().split(/\s+/)[0] ?? candidateName;

  if (t.length < 120) {
    issues.push({ code: "BODY_SHORT", message: "Body is too short (aim for 90–150 words)." });
  }
  if (t.split(/\s+/).length < 45) {
    issues.push({ code: "BODY_WORDS", message: "Body has too few words." });
  }
  if (/https?:\/\//i.test(t) || /\b\w+\.(com|io|dev|co)\//i.test(t)) {
    issues.push({ code: "BODY_URL", message: "Remove URLs and path fragments from the body." });
  }
  if (/^\s*(Hello|Hi)[^,\n]*,?\s*\n\n\s*[a-z]{0,6}\//im.test(t)) {
    issues.push({
      code: "BODY_FRAGMENT",
      message: "Second paragraph must not start with a URL path; write a full sentence about the role.",
    });
  }
  if (!/(Best,|Thanks,|Regards,)/i.test(t)) {
    issues.push({ code: "BODY_SIGNOFF", message: "Include a sign-off line (Best, or Thanks,)." });
  }
  if (!new RegExp(first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(t)) {
    issues.push({ code: "BODY_NAME", message: `Sign with candidate name (${candidateName}).` });
  }
  const afterGreet = t.replace(/^\s*(Hello|Hi[^\n]*,)\s*/i, "");
  if (afterGreet.length > 0 && /^[a-z]/.test(afterGreet)) {
    issues.push({ code: "BODY_OPEN", message: "First sentence after greeting must start with a capital letter." });
  }
  return issues;
}