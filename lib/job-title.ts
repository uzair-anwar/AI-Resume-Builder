function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type FilenameTitleOptions = {
  /** Hiring company names from the JD — never use these in download filenames. */
  hiringCompanyNames?: string[];
};

/** Short role label for PDF filenames (e.g. DevOps Engineer). Omits employer names from the JD. */
export function shortJobTitleForFilename(
  raw: string | undefined,
  opts?: FilenameTitleOptions,
): string {
  if (!raw?.trim()) return "Resume";
  let t = raw.trim();
  t = t.replace(/^position\s*title\s*:\s*/i, "");
  t = t.replace(/^job\s*title\s*:\s*/i, "");
  t = t.replace(/\s+at\s+[A-Za-z0-9][A-Za-z0-9.&' -]{0,48}$/i, "");

  const parts = t.split(/\s+[-–—|]\s+/);
  const tailNoise =
    /remote|duration|contract|extension|month|possible|full[- ]?time|hybrid|onsite|location/i;
  if (parts.length > 1 && (tailNoise.test(parts.slice(1).join(" ")) || t.length > 55)) {
    t = parts[0].trim();
  }

  for (const name of opts?.hiringCompanyNames ?? []) {
    const n = name.trim();
    if (n.length < 2) continue;
    t = t.replace(new RegExp(`\\b${escapeRegExp(n)}\\b`, "gi"), " ");
  }

  t = t
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.slice(0, 48) || "Resume";
}
