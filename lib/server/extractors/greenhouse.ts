import "server-only";

export function parseGreenhouseUrl(url: URL): { board: string; jobId: string } | null {
  const m = url.pathname.match(/\/([^/]+)\/jobs\/(\d+)/);
  if (!m) return null;
  return { board: m[1], jobId: m[2] };
}

export async function fetchGreenhouse(
  board: string,
  jobId: string,
): Promise<{ title: string; description: string } | null> {
  const api = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${jobId}`;
  const res = await fetch(api, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const json = await res.json();
  const title = json.title as string;
  const content = json.content as string;
  if (!content) return null;
  return { title, description: stripHtml(content) };
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
