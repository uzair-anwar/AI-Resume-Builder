import { NextResponse } from "next/server";
import { TailorStepRequestSchema } from "@/lib/schemas/tailoring-steps";
import { loadMasterResume, mergeProfileOverride } from "@/lib/server/master-resume";
import { runTailorStep } from "@/lib/server/tailor-steps/run-step";
import { prepareTailoringWorkspace } from "@/lib/server/tailoring-workspace";
import { PRIVATE_HEADERS } from "@/lib/api-headers";
import type { ProfileOverride } from "@/lib/schemas/profile";

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = TailorStepRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  const base = loadMasterResume();
  const override = parsed.data.profileOverride as ProfileOverride | undefined;
  const resume = mergeProfileOverride(base, override ?? null);
  const { tailoring, analysis } = prepareTailoringWorkspace(resume, parsed.data.jobDescription);

  try {
    const result = await runTailorStep(
      parsed.data.step,
      tailoring,
      parsed.data.jobDescription,
      {
        provider: parsed.data.provider,
        allowProviderFallback: parsed.data.allowProviderFallback,
        providerModels: parsed.data.providerModels,
      },
      parsed.data.previous ?? {},
      analysis,
    );
    return NextResponse.json({ ...result, analysis }, { headers: PRIVATE_HEADERS });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Step failed" },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }
}
