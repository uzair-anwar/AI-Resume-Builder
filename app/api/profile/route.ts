import { NextResponse } from "next/server";
import { loadMaster, getMasterEntry, listMasterOptions } from "@/lib/server/resume/registry";
import { withMaster } from "@/lib/server/layout-context";
import { buildDefaultResumeView } from "@/lib/resume/build-default-resume";
import { computeLineBudgets } from "@/lib/resume/layout/budgets";
import { PRIVATE_HEADERS } from "@/lib/shared/api-headers";

/** `GET /api/profile?masterId=java` → master content, default view, line budgets and the master list. */
export async function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get("masterId");
  const entry = getMasterEntry(requested);

  return withMaster(entry.id, () => {
    const master = loadMaster(entry.id);
    return NextResponse.json(
      {
        masterId: entry.id,
        templateId: entry.templateId,
        masters: listMasterOptions(),
        master,
        defaultResume: buildDefaultResumeView(master),
        lineBudgets: computeLineBudgets(master),
      },
      { headers: PRIVATE_HEADERS },
    );
  });
}
