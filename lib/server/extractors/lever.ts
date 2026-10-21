import "server-only";

export function parseLeverUrl(url: URL): { company: string; jobId: string } | null {
  const m = url.pathname.match(/\/([^/]+)\/([^/]+)/);
  if (!m) return null;
  return { company: m[1], jobId: m[2] };
}

export async function fetchLever(company: string, jobId: string): Promise<{ title: string; description: string } | null> {
  const api = `https://api.lever.co/v0/postings/${company}/${jobId}`;
  const res = await fetch(api, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const json = await res.json();
  const title = json.text as string;
  const lists = (json.lists as { content: string }[]) ?? [];
  const desc = lists.map((l) => stripHtml(l.content)).join("\n\n");
  const plain = json.descriptionPlain as string | undefined;
  const description = plain ?? desc;
  if (!description) return null;
  return { title, description };
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .trim();
}
