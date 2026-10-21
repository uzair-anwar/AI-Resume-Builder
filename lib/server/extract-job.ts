import "server-only";
import { safeFetch, SafeFetchError } from "./safe-fetch";
import { parseGreenhouseUrl, fetchGreenhouse } from "./extractors/greenhouse";
import { parseLeverUrl, fetchLever } from "./extractors/lever";
import { parseAshbyUrl, fetchAshby } from "./extractors/ashby";
import { extractJsonLdJobPosting } from "./extractors/jsonld";
import { extractHtmlJobDescription } from "./extractors/html";

export type ExtractResult = {
  title?: string;
  description: string;
  source: "greenhouse" | "lever" | "ashby" | "jsonld" | "html" | "paste";
  warnings: string[];
};

export async function extractJobFromUrl(urlString: string): Promise<ExtractResult> {
  const url = new URL(urlString);
  const warnings: string[] = [];

  const gh = parseGreenhouseUrl(url);
  if (gh && (url.hostname.includes("greenhouse.io") || url.hostname.includes("job-boards"))) {
    const data = await fetchGreenhouse(gh.board, gh.jobId);
    if (data) {
      return { title: data.title, description: data.description, source: "greenhouse", warnings };
    }
  }

  if (url.hostname.includes("lever.co") || url.hostname.includes("jobs.lever.co")) {
    const lv = parseLeverUrl(url);
    if (lv) {
      const data = await fetchLever(lv.company, lv.jobId);
      if (data)
        return { title: data.title, description: data.description, source: "lever", warnings };
    }
  }

  if (url.hostname.includes("ashbyhq.com")) {
    const ab = parseAshbyUrl(url);
    if (ab) {
      const data = await fetchAshby(ab.org, ab.jobId);
      if (data)
        return { title: data.title, description: data.description, source: "ashby", warnings };
    }
  }

  let html: string;
  try {
    const fetched = await safeFetch(urlString);
    if (fetched.status >= 400) {
      throw new SafeFetchError("Page returned an error status", "HTTP_ERROR");
    }
    html = fetched.body;
    if (fetched.truncated) warnings.push("Response was truncated due to size limits.");
  } catch (e) {
    if (e instanceof SafeFetchError && e.code === "PASTE_REQUIRED") {
      throw e;
    }
    throw e;
  }

  const jsonld = extractJsonLdJobPosting(html);
  if (jsonld) {
    return { title: jsonld.title, description: jsonld.description, source: "jsonld", warnings };
  }

  const heuristic = extractHtmlJobDescription(html);
  if (heuristic) {
    warnings.push("Extracted using HTML heuristics; please review before tailoring.");
    return { title: heuristic.title, description: heuristic.description, source: "html", warnings };
  }

  throw new SafeFetchError(
    "Could not extract job description; paste it manually",
    "EXTRACT_FAILED",
  );
}
