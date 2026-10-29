const KEY = "resume_tailor_draft";

export type SessionDraft = {
  jobUrl?: string;
  jobDescription?: string;
  jobTitle?: string;
  pdfBasename?: string;
};

export function loadDraft(): SessionDraft {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as SessionDraft;
  } catch {
    return {};
  }
}

export function saveDraft(draft: SessionDraft) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(draft));
}
