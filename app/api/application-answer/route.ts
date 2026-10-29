import { NextResponse } from "next/server";
import { ApplicationAnswerRequestSchema } from "@/lib/schemas/application-answer";
import { loadMasterResume, mergeProfileOverride } from "@/lib/server/resume/master-resume";
import { generateApplicationAnswer } from "@/lib/server/application-answer/application-answer";
import { PRIVATE_HEADERS } from "@/lib/shared/api-headers";
import type { ProfileOverride } from "@/lib/schemas/profile";

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = ApplicationAnswerRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid application answer request" },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  const base = loadMasterResume();
  const override = parsed.data.profileOverride as ProfileOverride | undefined;
  const resume = mergeProfileOverride(base, override ?? null);

  try {
    const response = await generateApplicationAnswer(
      parsed.data.question,
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
      { error: e instanceof Error ? e.message : "Failed to generate answer" },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }
}
