import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/server/auth";
import { loadMasterResume } from "@/lib/server/master-resume";
import { buildDefaultResumeView } from "@/lib/build-default-resume";
import { PRIVATE_HEADERS } from "@/lib/api-headers";
import { loadRoleFamilies } from "@/lib/server/role-families";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: PRIVATE_HEADERS });
  }

  const master = loadMasterResume();
  const defaultResume = buildDefaultResumeView(master);
  const roleFamilies = loadRoleFamilies().map((f) => ({ id: f.id, label: f.label }));

  return NextResponse.json(
    {
      master,
      defaultResume,
      roleFamilies,
    },
    { headers: PRIVATE_HEADERS },
  );
}
