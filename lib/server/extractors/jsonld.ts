import "server-only";
import * as cheerio from "cheerio";

export function extractJsonLdJobPosting(html: string): { title?: string; description: string } | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');
  for (const el of scripts.toArray()) {
    const text = $(el).html();
    if (!text) continue;
    try {
      const data = JSON.parse(text);
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const type = node["@type"];
        const types = Array.isArray(type) ? type : [type];
        if (types.includes("JobPosting")) {
          const title = node.title as string | undefined;
          const desc = (node.description as string) ?? "";
          if (desc) return { title, description: stripHtml(desc) };
        }
      }
    } catch {
      /* continue */
    }
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}
