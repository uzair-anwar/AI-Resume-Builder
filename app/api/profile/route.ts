import "@/lib/server/layout-fonts";
import { NextResponse } from "next/server";
import { loadMasterResume } from "@/lib/server/master-resume";
import { buildDefaultResumeView } from "@/lib/build-default-resume";
import { computeLineBudgets } from "@/lib/layout/budgets";
import { PRIVATE_HEADERS } from "@/lib/api-headers";

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
