import "server-only";

export function parseAshbyUrl(url: URL): { org: string; jobId: string } | null {
  const m = url.pathname.match(/\/([^/]+)\/([^/]+)/);
  if (!m) return null;
  return { org: m[1], jobId: m[2] };
}

export async function fetchAshby(
  org: string,
  jobId: string,
): Promise<{ title: string; description: string } | null> {
  const api = `https://api.ashbyhq.com/posting-api/job-board/${org}`;
  const res = await fetch(api, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const json = await res.json();
  const jobs =
    (json.jobs as {
      id: string;
      title: string;
      descriptionHtml?: string;
      descriptionPlain?: string;
    }[]) ?? [];
  const job = jobs.find((j) => j.id === jobId || j.id.endsWith(jobId));
  if (!job) return null;
  const description = job.descriptionPlain ?? stripHtml(job.descriptionHtml ?? "");
  if (!description) return null;
  return { title: job.title, description };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
