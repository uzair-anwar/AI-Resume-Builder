import "server-only";
import * as cheerio from "cheerio";

type ZohoJobRecord = {
  id?: string;
  Posting_Title?: string;
  Job_Opening_Name?: string;
  Job_Description?: string;
};

/** e.g. /jobs/Careers/689994000019541045/Back-End-Developers */
export function parseZohoRecruitJobId(url: URL): string | null {
  if (!url.hostname.toLowerCase().includes("zohorecruit.com")) return null;
  const m = url.pathname.match(/\/jobs\/[^/]+\/(\d{10,})(?:\/|$)/);
  return m?.[1] ?? null;
}

function decodeJsSingleQuotedLiteral(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c !== "\\") {
      out += c;
      continue;
    }
    const next = raw[++i];
    if (next === "x" && /^[0-9a-fA-F]{2}/.test(raw.slice(i + 1, i + 3))) {
      out += String.fromCharCode(parseInt(raw.slice(i + 1, i + 3), 16));
      i += 2;
      continue;
    }
    if (next === "\\") out += "\\";
    else if (next === "'") out += "'";
    else if (next === "n") out += "\n";
    else if (next === "r") out += "\r";
    else if (next === "t") out += "\t";
    else if (next === "-") out += "-";
    else if (next === "/") out += "/";
    else out += next ?? "";
  }
  return out;
}

function parseZohoJobsArray(html: string): ZohoJobRecord[] | null {
  const m = html.match(/var\s+jobs\s*=\s*JSON\.parse\('([\s\S]*?)'\)\s*;/);
  if (!m?.[1]) return null;
  try {
    const jsonText = decodeJsSingleQuotedLiteral(m[1]);
    const parsed = JSON.parse(jsonText) as unknown;
    return Array.isArray(parsed) ? (parsed as ZohoJobRecord[]) : null;
  } catch {
    return null;
  }
}

function htmlFragmentToText(html: string): string {
  const $ = cheerio.load(`<div id="__z">${html}</div>`);
  const root = $("#__z");
  root.find("br").replaceWith("\n");
  root.find("p, div, li, h1, h2, h3, h4, h5, h6, tr, section").each((_, node) => {
    $(node).append("\n");
  });
  root.find("li").each((_, node) => {
    $(node).prepend("• ");
  });
  return root
    .text()
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pickJob(records: ZohoJobRecord[], jobId: string | null): ZohoJobRecord | null {
  if (!records.length) return null;
  if (jobId) {
    const match = records.find((r) => r.id === jobId);
    if (match) return match;
  }
  return records.length === 1 ? records[0] : null;
}

function titleFromRecord(job: ZohoJobRecord): string | undefined {
  return job.Posting_Title?.trim() || job.Job_Opening_Name?.trim() || undefined;
}

/**
 * Zoho Recruit career sites render via Lyte; the full posting is in
 * `var jobs = JSON.parse('…')` with \\xNN-escaped JSON, not in the DOM.
 */
export function extractZohoRecruitFromHtml(
  html: string,
  jobId: string | null,
): { title?: string; description: string } | null {
  const records = parseZohoJobsArray(html);
  if (!records?.length) return null;

  const job = pickJob(records, jobId);
  const rawDesc = job?.Job_Description;
  if (!rawDesc || rawDesc.length < 80) return null;

  const description = htmlFragmentToText(rawDesc);
  if (description.length < 200) return null;

  return {
    title: job ? titleFromRecord(job) : undefined,
    description: description.slice(0, 15000),
  };
}
