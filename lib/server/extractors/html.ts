import "server-only";
import * as cheerio from "cheerio";

const SELECTORS = [
  "[data-automation-id='jobPostingDescription']",
  ".job-description",
  "#job-description",
  ".posting-page",
  "article",
  "main",
];

export function extractHtmlJobDescription(
  html: string,
): { title?: string; description: string } | null {
  const $ = cheerio.load(html);
  const title =
    $("h1").first().text().trim() ||
    $("title").text().trim() ||
    $('meta[property="og:title"]').attr("content");

  for (const sel of SELECTORS) {
    const el = $(sel).first();
    if (el.length) {
      const text = el
        .text()
        .replace(/\s+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      if (text.length > 200) {
        return { title, description: text.slice(0, 15000) };
      }
    }
  }

  const body = $("body").text().replace(/\s+/g, " ").trim();
  if (body.length > 300) {
    return { title, description: body.slice(0, 12000) };
  }
  return null;
}
