export const OUTREACH_DRAFT_KEY = "resume_tailor_outreach_email";

export type OutreachEmailDraft = {
  to: string;
  recipientName: string;
  subject: string;
  body: string;
  resumeBasename?: string;
};

export function saveOutreachEmailDraft(draft: OutreachEmailDraft): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(OUTREACH_DRAFT_KEY, JSON.stringify(draft));
}

export function loadOutreachEmailDraft(): OutreachEmailDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(OUTREACH_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as OutreachEmailDraft) : null;
  } catch {
    return null;
  }
}
