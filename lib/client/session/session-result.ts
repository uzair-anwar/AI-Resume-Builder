import type { ResumeView } from "@/lib/schemas/resume";
import type { JobAnalysis, TailorResponse } from "@/lib/schemas/tailoring";
import type { CoverLetterVariants } from "@/lib/schemas/cover-letter";
import type { LineBudgets } from "@/lib/layout/budgets";

const KEY = "resume_tailor_last_result";

export type StoredTailorSession = {
  pipelineKey: string;
  jobTitle: string;
  resume: ResumeView;
  analysis: JobAnalysis;
  budgets?: LineBudgets;
  warnings: string[];
  aiUsage?: TailorResponse["aiUsage"];
  coverLetter?: CoverLetterVariants | null;
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
