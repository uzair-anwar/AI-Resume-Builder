import type { ProfileOverride } from "@/lib/schemas/profile";

/** Profile overrides are stored per master resume. The un-suffixed key is the pre-multi-master MERN override. */
const LEGACY_KEY = "resume_tailor_profile_override";
const LEGACY_MASTER_ID = "mern";

const keyFor = (masterId: string) => `${LEGACY_KEY}:${masterId}`;

function readKey(key: string): ProfileOverride | null {
  const raw = sessionStorage.getItem(key) ?? localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as ProfileOverride) : null;
}

export function loadProfileOverride(masterId: string = LEGACY_MASTER_ID): ProfileOverride | null {
  if (typeof window === "undefined") return null;
  try {
    return readKey(keyFor(masterId)) ?? (masterId === LEGACY_MASTER_ID ? readKey(LEGACY_KEY) : null);
  } catch {
    return null;
  }
}

export function saveProfileOverride(
  override: ProfileOverride | null,
  masterId: string = LEGACY_MASTER_ID,
) {
  if (typeof window === "undefined") return;
  const key = keyFor(masterId);
  if (masterId === LEGACY_MASTER_ID) {
    // The legacy value has been migrated to the suffixed key.
    sessionStorage.removeItem(LEGACY_KEY);
    localStorage.removeItem(LEGACY_KEY);
  }
  if (!override) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
    return;
  }
  const s = JSON.stringify(override);
  sessionStorage.setItem(key, s);
  localStorage.setItem(key, s);
}
