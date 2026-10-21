/** Short role label for PDF filenames (e.g. DevOps Engineer). */
export function shortJobTitleForFilename(raw: string | undefined): string {
  if (!raw?.trim()) return "Resume";
  let t = raw.trim();
  t = t.replace(/^position\s*title\s*:\s*/i, "");
  t = t.replace(/^job\s*title\s*:\s*/i, "");

  const parts = t.split(/\s+[-–—|]\s+/);
  const tailNoise =
    /remote|duration|contract|extension|month|possible|full[- ]?time|hybrid|onsite|location/i;
  if (parts.length > 1 && (tailNoise.test(parts.slice(1).join(" ")) || t.length > 55)) {
    t = parts[0].trim();
  }

  t = t
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.slice(0, 48) || "Resume";
}
