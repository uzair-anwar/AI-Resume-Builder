import type { ProfileOverride } from "@/lib/schemas/profile";

const KEY = "resume_tailor_profile_override";

export function loadProfileOverride(): ProfileOverride | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ProfileOverride;
  } catch {
    return null;
  }
}

export function saveProfileOverride(override: ProfileOverride | null) {
  if (typeof window === "undefined") return;
  if (!override) {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
    return;
  }
  const s = JSON.stringify(override);
  sessionStorage.setItem(KEY, s);
  localStorage.setItem(KEY, s);
}
