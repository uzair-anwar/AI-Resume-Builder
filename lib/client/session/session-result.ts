import type { ResumeView } from "@/lib/schemas/resume";
import type { JobAnalysis, TailorResponse } from "@/lib/schemas/tailoring";
import type { CoverLetterVariants } from "@/lib/schemas/cover-letter";
import type { OutreachEmail } from "@/lib/schemas/outreach-email";
import type { LineBudgets } from "@/lib/resume/layout/budgets";

const KEY = "resume_tailor_last_result";

export type StoredTailorSession = {
  /** Master resume this session was generated from (absent in sessions saved before multi-master → "mern"). */
  masterId?: string;
  pipelineKey: string;
  jobTitle: string;
  pdfBasename?: string;
  resume: ResumeView;
  analysis: JobAnalysis;
  budgets?: LineBudgets;
  warnings: string[];
  aiUsage?: TailorResponse["aiUsage"];
  coverLetter?: CoverLetterVariants | null;
  outreachEmail?: OutreachEmail | null;
  outreachRecipientEmail?: string;
  outreachRecipientName?: string;
};

export function loadStoredTailorSession(): StoredTailorSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredTailorSession;
  } catch {
    return null;
  }
}

export function saveStoredTailorSession(session: StoredTailorSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearStoredTailorSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
