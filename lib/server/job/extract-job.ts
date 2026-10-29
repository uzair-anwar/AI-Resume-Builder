import "server-only";
import { safeFetch, SafeFetchError } from "@/lib/server/safe-fetch";
import { parseGreenhouseUrl, fetchGreenhouse } from "./extractors/greenhouse";
import { parseLeverUrl, fetchLever } from "./extractors/lever";
import { parseAshbyUrl, fetchAshby } from "./extractors/ashby";
import { extractJsonLdJobPosting } from "./extractors/jsonld";
import { extractHtmlJobDescription, extractEmbeddedJson } from "./extractors/html";
import { parseZohoRecruitJobId, extractZohoRecruitFromHtml } from "./extractors/zoho-recruit";
import { detectWall, guessWallFromEmptyPage, type WallKind } from "./extractors/wall";
import { findJobBoard, loginRequiredMessage, botBlockedMessage } from "@/lib/shared/job-boards";
import { shortJobTitleForFilename } from "@/lib/shared/job-title";

export type ExtractResult = {
  title?: string;
  description: string;
  source:
    | "greenhouse"
    | "lever"
    | "ashby"
    | "zoho"
    | "jsonld"
    | "embedded"
    | "html"
    | "paste";
  warnings: string[];
};

function withShortTitle(title?: string): string | undefined {
  return title ? shortJobTitleForFilename(title) : undefined;
}

export async function extractJobFromUrl(urlString: string): Promise<ExtractResult> {
  const url = new URL(urlString);
  const warnings: string[] = [];

  const gh = parseGreenhouseUrl(url);
  if (gh && (url.hostname.includes("greenhouse.io") || url.hostname.includes("job-boards"))) {
    const data = await fetchGreenhouse(gh.board, gh.jobId);
    if (data) {
      return {
        title: withShortTitle(data.title),
        description: data.description,
        source: "greenhouse",
        warnings,
      };
    }
  }

  if (url.hostname.includes("lever.co") || url.hostname.includes("jobs.lever.co")) {
    const lv = parseLeverUrl(url);
    if (lv) {
      const data = await fetchLever(lv.company, lv.jobId);
      if (data)
        return {
          title: withShortTitle(data.title),
          description: data.description,
          source: "lever",
          warnings,
        };
    }
  }

  if (url.hostname.includes("ashbyhq.com")) {
    const ab = parseAshbyUrl(url);
    if (ab) {
      const data = await fetchAshby(ab.org, ab.jobId);
      if (data)
        return {
          title: withShortTitle(data.title),
          description: data.description,
          source: "ashby",
          warnings,
        };
    }
  }

  const board = findJobBoard(url.hostname);

  let html: string;
  let status = 200;
  try {
    const fetched = await safeFetch(urlString);
    status = fetched.status;
    html = fetched.body;
    if (fetched.truncated) warnings.push("Response was truncated due to size limits.");
  } catch (e) {
    if (e instanceof SafeFetchError && e.code === "CONTENT_TYPE") {
      throw new SafeFetchError(
        `${board?.name ?? "This page"} did not return a readable web page. Paste the job description below instead.`,
        "EXTRACT_FAILED",
      );
    }
    throw e;
  }

  if (status === 404 || status === 410) {
    throw new SafeFetchError(
      "That job page was not found (it may have expired). Check the link or paste the description.",
      "NOT_FOUND",
    );
  }
  if (status === 401) {
    throw new SafeFetchError(loginRequiredMessage(board?.name), "LOGIN_REQUIRED");
  }
  if (status >= 400) {
    throw new SafeFetchError(botBlockedMessage(board?.name), "BOT_BLOCKED");
  }

  const zohoJobId = parseZohoRecruitJobId(url);
  if (url.hostname.toLowerCase().includes("zohorecruit.com") || zohoJobId) {
    const zoho = extractZohoRecruitFromHtml(html, zohoJobId);
    if (zoho) {
      return {
        title: withShortTitle(zoho.title),
        description: zoho.description,
        source: "zoho",
        warnings,
      };
    }
  }

  const jsonld = extractJsonLdJobPosting(html);
  if (jsonld && jsonld.description.length > 80) {
    return {
      title: withShortTitle(jsonld.title),
      description: jsonld.description,
      source: "jsonld",
      warnings,
    };
  }

  const wall = detectWall(status, html);
  if (wall) throwWall(wall, board?.name);

  const embedded = extractEmbeddedJson(html);
  const heuristic = extractHtmlJobDescription(html);

  if (embedded && (embedded.description.length >= 1500 || !heuristic)) {
    return {
      title: withShortTitle(embedded.title ?? heuristic?.title),
      description: embedded.description,
      source: "embedded",
      warnings,
    };
  }

  if (heuristic) {
    const guess = guessWallFromEmptyPage(html);
    if (guess && heuristic.description.length < 800) throwWall(guess, board?.name);
    const useEmbedded =
      embedded && embedded.description.length * 1.2 >= heuristic.description.length;
    if (!useEmbedded) {
      warnings.push("Extracted using HTML heuristics; please review before tailoring.");
    }
    return {
      title: withShortTitle((useEmbedded ? embedded?.title : undefined) ?? heuristic.title),
      description: useEmbedded && embedded ? embedded.description : heuristic.description,
      source: useEmbedded ? "embedded" : "html",
      warnings,
    };
  }

  const guess = guessWallFromEmptyPage(html);
  if (guess) throwWall(guess, board?.name);

  throw new SafeFetchError(
    `Could not read the job description from ${board?.name ?? "this page"}; paste it manually.`,
    "EXTRACT_FAILED",
  );
}

function throwWall(kind: WallKind, boardName?: string): never {
  if (kind === "login") {
    throw new SafeFetchError(loginRequiredMessage(boardName), "LOGIN_REQUIRED");
  }
  throw new SafeFetchError(botBlockedMessage(boardName), "BOT_BLOCKED");
}
