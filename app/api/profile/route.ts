import "@/lib/server/layout-fonts";
import { NextResponse } from "next/server";
import { loadMasterResume } from "@/lib/server/resume/master-resume";
import { buildDefaultResumeView } from "@/lib/resume/build-default-resume";
import { computeLineBudgets } from "@/lib/resume/layout/budgets";
import { PRIVATE_HEADERS } from "@/lib/shared/api-headers";

export async function GET() {
  const master = loadMasterResume();
  const defaultResume = buildDefaultResumeView(master);
  const lineBudgets = computeLineBudgets(master);

  return NextResponse.json(
    {
      master,
      defaultResume,
      lineBudgets,
    },
    { headers: PRIVATE_HEADERS },
  );
}
