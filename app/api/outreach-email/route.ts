import { NextResponse } from "next/server";
import { OutreachEmailRequestSchema } from "@/lib/schemas/outreach-email";
import { mergeProfileOverride } from "@/lib/server/resume/master-resume";
import { loadMaster } from "@/lib/server/resume/registry";
import { withMaster } from "@/lib/server/layout-context";
import { generateOutreachEmail } from "@/lib/server/outreach-email/outreach-email";
import { PRIVATE_HEADERS } from "@/lib/shared/api-headers";
import type { ProfileOverride } from "@/lib/schemas/profile";

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = OutreachEmailRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid outreach email request" },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  return withMaster(parsed.data.masterId, async () => {
    const base = loadMaster(parsed.data.masterId);
    const override = parsed.data.profileOverride as ProfileOverride | undefined;
    const resume = mergeProfileOverride(base, override ?? null);

    try {
      const response = await generateOutreachEmail(
        resume,
        parsed.data.jobDescription,
        {
          provider: parsed.data.provider,
          allowProviderFallback: parsed.data.allowProviderFallback,
          providerModels: parsed.data.providerModels,
        },
        parsed.data.tailoredResume,
        parsed.data.jobTitle,
        parsed.data.recipientName,
      );
      return NextResponse.json(response, { headers: PRIVATE_HEADERS });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Failed to generate email" },
        { status: 500, headers: PRIVATE_HEADERS },
      );
    }
  });
}
