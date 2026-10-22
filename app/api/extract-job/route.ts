import { NextResponse } from "next/server";
import { ExtractJobRequestSchema } from "@/lib/schemas/job";
import { extractJobFromUrl } from "@/lib/server/job/extract-job";
import { SafeFetchError } from "@/lib/server/safe-fetch";
import { logError, logInfo } from "@/lib/server/log";
import { PRIVATE_HEADERS } from "@/lib/shared/api-headers";

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = ExtractJobRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400, headers: PRIVATE_HEADERS });
  }

  try {
    logInfo("extract_job_start");
    const result = await extractJobFromUrl(parsed.data.url);
    logInfo("extract_job_done", { source: result.source });
    return NextResponse.json(result, { headers: PRIVATE_HEADERS });
  } catch (e) {
    if (e instanceof SafeFetchError) {
      logError("extract_job_failed", { code: e.code });
      const status = ["LOGIN_REQUIRED", "BOT_BLOCKED", "NOT_FOUND"].includes(e.code) ? 422 : 400;
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status, headers: PRIVATE_HEADERS },
      );
    }
    logError("extract_job_error");
    return NextResponse.json(
      { error: "Extraction failed" },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }
}
