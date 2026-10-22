import { NextResponse } from "next/server";
import { CoverLetterRequestSchema } from "@/lib/schemas/cover-letter";
import { loadMasterResume, mergeProfileOverride } from "@/lib/server/resume/master-resume";
import { generateCoverLetter } from "@/lib/server/cover-letter/cover-letter";
import { PRIVATE_HEADERS } from "@/lib/shared/api-headers";
import type { ProfileOverride } from "@/lib/schemas/profile";

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = CoverLetterRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid cover letter request" },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  const base = loadMasterResume();
  const override = parsed.data.profileOverride as ProfileOverride | undefined;
  const resume = mergeProfileOverride(base, override ?? null);

  try {
    const response = await generateCoverLetter(
      resume,
      parsed.data.jobDescription,
      {
        provider: parsed.data.provider,
        allowProviderFallback: parsed.data.allowProviderFallback,
        providerModels: parsed.data.providerModels,
      },
      parsed.data.tailoredResume,
      parsed.data.jobTitle,
    );
    return NextResponse.json(response, { headers: PRIVATE_HEADERS });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to generate cover letter" },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }
}
