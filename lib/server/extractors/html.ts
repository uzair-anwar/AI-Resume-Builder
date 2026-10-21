import "server-only";
import * as cheerio from "cheerio";

const SELECTORS = [
  "[data-automation-id='jobPostingDescription']",
  "[itemprop='description']",
  "[data-testid*='description' i]",
  "[class*='job-description' i]",
  "[class*='jobDescription' i]",
  "[class*='job_description' i]",
  "[class*='JobDescription']",
  "[id*='job-description' i]",
  "[id*='job_description' i]",
  "[id*='jobDescription']",
  "#job-details",
  ".job-details",
  ".job-detail",
  ".listing-container",
  "[class*='posting' i] [class*='content' i]",
  ".posting-page",
  "article",
  "main",
];

const NOISE = "script, style, noscript, nav, header, footer, svg, form, iframe, aside, button";

function cleanText(text: string): string {
  return text
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function textWithBreaks($: cheerio.CheerioAPI, el: ReturnType<cheerio.CheerioAPI>): string {
  const clone = el.clone();
  clone.find("br").replaceWith("\n");
  clone.find("p, div, li, h1, h2, h3, h4, h5, h6, tr, section").each((_, node) => {
    $(node).append("\n");
  });
  clone.find("li").each((_, node) => {
    $(node).prepend("• ");
  });
  return cleanText(clone.text());
}

export function extractHtmlJobDescription(
  html: string,
): { title?: string; description: string } | null {
  const $ = cheerio.load(html);
  const title =
    $("h1").first().text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    $("title").text().trim() ||
    undefined;

  $(NOISE).remove();

  for (const sel of SELECTORS) {
    const el = $(sel).first();
    if (!el.length) continue;
    const text = textWithBreaks($, el);
    if (text.length > 200) {
      return { title, description: text.slice(0, 15000) };
    }
  }

  const body = textWithBreaks($, $("body"));
  if (body.length > 300) {
    return { title, description: body.slice(0, 12000) };
  }
  return null;
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const TITLE_KEYS = ["title", "jobTitle", "job_title", "name", "position", "positionName"];
const DESC_KEYS = [
  "description",
  "jobDescription",
  "job_description",
  "body",
  "descriptionHtml",
  "content",
  "details",
];

function htmlToText(value: string): string {
  if (!/<[a-z][\s\S]*>/i.test(value)) return cleanText(value);
  const $ = cheerio.load(`<div id="__r">${value}</div>`);
  return textWithBreaks($, $("#__r"));
}

/**
 * Many boards (Next.js, Nuxt, SPA shells) embed the job as JSON in a script tag.
 * Walk every JSON blob and take the object with the longest description-like string.
 */
export function extractEmbeddedJson(html: string): { title?: string; description: string } | null {
  const $ = cheerio.load(html);
  const blobs: Json[] = [];

  $('script[type="application/json"], script#__NEXT_DATA__').each((_, el) => {
    const text = $(el).html();
    if (!text || text.length > 2_000_000) return;
    try {
      blobs.push(JSON.parse(text) as Json);
    } catch {
      /* ignore */
    }
  });
  if (!blobs.length) return null;

  let best: { title?: string; description: string } | null = null;

  const visit = (node: Json, depth: number) => {
    if (depth > 12 || node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const n of node) visit(n, depth + 1);
      return;
    }
    for (const key of DESC_KEYS) {
      const v = node[key];
      if (typeof v === "string" && v.length > 300) {
        const description = htmlToText(v);
        if (description.length > 300 && (!best || description.length > best.description.length)) {
          const titleKey = TITLE_KEYS.find((k) => typeof node[k] === "string");
          best = {
            title: titleKey ? (node[titleKey] as string) : undefined,
            description: description.slice(0, 15000),
          };
        }
      }
    }
    for (const v of Object.values(node)) visit(v, depth + 1);
  };
  for (const b of blobs) visit(b, 0);
  return best;
}
