import "server-only";
import * as cheerio from "cheerio";

export type WallKind = "login" | "bot";

const BOT_MARKERS = [
  "just a moment",
  "attention required",
  "verify you are human",
  "verifying you are human",
  "checking your browser",
  "enable javascript and cookies",
  "unusual traffic",
  "access denied",
  "request blocked",
  "are you a robot",
  "captcha",
  "authenticating",
];

const LOGIN_MARKERS = [
  "sign in to view",
  "log in to view",
  "login to view",
  "sign in to see",
  "sign in to continue",
  "log in to continue",
  "please sign in",
  "please log in",
  "create an account to view",
  "join to view",
  "sign up to view",
];

/** Looks at an HTTP response and decides whether it is a login or bot wall instead of a job page. */
export function detectWall(status: number, html: string): WallKind | null {
  if (status === 401) return "login";
  if (status === 403 || status === 429 || status === 503) return "bot";

  const $ = cheerio.load(html);
  const title = $("title").text().toLowerCase();
  $("script, style, noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ").toLowerCase();

  if (BOT_MARKERS.some((m) => title.includes(m))) return "bot";
  if (text.length < 4000 && BOT_MARKERS.some((m) => text.includes(m))) return "bot";
  if (LOGIN_MARKERS.some((m) => text.includes(m)) && text.length < 6000) return "login";
  return null;
}

/** Same check but for a page we could not extract anything meaningful from. */
export function guessWallFromEmptyPage(html: string): WallKind | null {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const text = $("body").text().replace(/\s+/g, " ").toLowerCase();
  if (/\b(sign in|log in|login)\b/.test(text) && text.length < 3000) return "login";
  if (BOT_MARKERS.some((m) => text.includes(m))) return "bot";
  return null;
}
