const KEY = "resume_tailor_selected_master";

/** The master resume the user picked last (null = never chosen → server default). */
export function loadSelectedMasterId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveSelectedMasterId(id: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* ignore quota / privacy mode */
  }
}
