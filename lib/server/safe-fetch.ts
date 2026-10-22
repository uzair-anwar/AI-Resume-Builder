import "server-only";
import dns from "dns/promises";
import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from "undici";
import { findJobBoard, loginRequiredMessage } from "@/lib/shared/job-boards";
import { isBlockedHostname, isBlockedIp, validateResolvedAddresses } from "./ip-guard";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 1.5 * 1024 * 1024;

export class SafeFetchError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

function validateUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeFetchError("Only HTTP/HTTPS URLs are allowed", "INVALID_PROTOCOL");
  }
  if (url.username || url.password) {
    throw new SafeFetchError("URLs with credentials are not allowed", "CREDENTIALS");
  }
  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  if (port !== 80 && port !== 443) {
    throw new SafeFetchError("Only ports 80 and 443 are allowed", "INVALID_PORT");
  }
  const host = url.hostname.toLowerCase();
  if (isBlockedHostname(host)) {
    throw new SafeFetchError("Hostname is not allowed", "BLOCKED_HOST");
  }
  const board = findJobBoard(host);
  if (board?.access === "login") {
    throw new SafeFetchError(loginRequiredMessage(board.name), "LOGIN_REQUIRED");
  }
  if (ipaddrLooksLikeIp(host) && isBlockedIp(host)) {
    throw new SafeFetchError("IP address is not allowed", "BLOCKED_IP");
  }
}

function ipaddrLooksLikeIp(host: string): boolean {
  return /^[\d.a-fA-F:]+$/.test(host) || /^\d+$/.test(host);
}

async function resolveAndValidate(hostname: string): Promise<string[]> {
  if (ipaddrLooksLikeIp(hostname)) {
    if (isBlockedIp(hostname)) throw new SafeFetchError("IP address is not allowed", "BLOCKED_IP");
    return [hostname];
  }
  const results = await dns.lookup(hostname, { all: true, verbatim: true });
  const ips = results.map((r) => r.address);
  if (!validateResolvedAddresses(ips)) {
    throw new SafeFetchError("Resolved to a private or reserved address", "BLOCKED_IP");
  }
  return ips;
}

function createPinnedAgent(hostname: string, allowedIps: string[]): Agent {
  const allowed = new Set(allowedIps);
  return new Agent({
    connect: {
      lookup: (host, _opts, cb) => {
        if (host !== hostname) {
          cb(new Error("DNS rebinding detected"), "");
          return;
        }
        dns
          .lookup(hostname, { all: true, verbatim: true })
          .then((addrs) => {
            const filtered = addrs.filter((a) => allowed.has(a.address) && !isBlockedIp(a.address));
            if (!filtered.length) {
              cb(new Error("No safe addresses"), "");
              return;
            }
            cb(
              null,
              filtered.map((a) => ({ address: a.address, family: a.family })),
            );
          })
          .catch((err) => cb(err as Error, ""));
      },
    },
  });
}

async function readLimitedBody(
  body: ReadableStream<Uint8Array> | null,
): Promise<{ text: string; truncated: boolean }> {
  if (!body) return { text: "", truncated: false };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.length;
    if (total > MAX_BYTES) {
      truncated = true;
      const overflow = total - MAX_BYTES;
      chunks.push(value.subarray(0, value.length - overflow));
      break;
    }
    chunks.push(value);
  }
  const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return { text: buf.toString("utf8"), truncated };
}

export type SafeFetchResult = {
  url: string;
  status: number;
  contentType: string;
  body: string;
  truncated: boolean;
};

export type SafeFetchOptions = {
  userAgent?: string;
};

export async function safeFetch(
  initialUrl: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  let current = new URL(initialUrl);
  let redirects = 0;

  while (true) {
    validateUrl(current);
    const hostname = current.hostname;
    const allowedIps = await resolveAndValidate(hostname);
    const agent = createPinnedAgent(hostname, allowedIps);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const init: UndiciRequestInit = {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": options.userAgent ?? BROWSER_UA,
          Accept: "text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        dispatcher: agent,
      };

      const res = await undiciFetch(current.toString(), init);
      clearTimeout(timer);

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) throw new SafeFetchError("Redirect without location", "REDIRECT");
        if (redirects >= MAX_REDIRECTS) {
          throw new SafeFetchError("Too many redirects", "REDIRECT_LIMIT");
        }
        redirects += 1;
        current = new URL(loc, current);
        continue;
      }

      const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
      if (
        !contentType.includes("text/html") &&
        !contentType.includes("xhtml") &&
        !contentType.includes("application/json") &&
        !contentType.includes("text/plain")
      ) {
        throw new SafeFetchError("Unsupported content type", "CONTENT_TYPE");
      }

      const { text, truncated } = await readLimitedBody(
        res.body as ReadableStream<Uint8Array> | null,
      );
      return {
        url: current.toString(),
        status: res.status,
        contentType,
        body: text,
        truncated,
      };
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof SafeFetchError) throw e;
      if ((e as Error).name === "AbortError") {
        throw new SafeFetchError("Request timed out", "TIMEOUT");
      }
      throw new SafeFetchError("Failed to fetch URL", "FETCH_FAILED");
    }
  }
}
