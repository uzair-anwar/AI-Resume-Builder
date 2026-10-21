const KEY = "resume_tailor_draft";

export type SessionDraft = {
  jobUrl?: string;
  jobDescription?: string;
  jobTitle?: string;
  roleFamilyId?: string;
};

export function loadDraft(): SessionDraft {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as SessionDraft;
  } catch {
    return {};
  }
}

export function saveDraft(draft: SessionDraft) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(draft));
}
