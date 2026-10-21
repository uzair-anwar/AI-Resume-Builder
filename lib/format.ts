export function formatDateRange(start: string, end: string | null): string {
  const fmt = (d: string) => {
    const [y, m] = d.split("-");
    const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const idx = months.indexOf(m);
    return idx >= 0 ? `${names[idx]} ${y}` : d;
  };
  const endStr = end ? fmt(end) : "Present";
  return `${fmt(start)} – ${endStr}`;
}

export function slugifyFilename(parts: string[]): string {
  return parts
    .join("_")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
}
