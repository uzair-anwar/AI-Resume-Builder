import { NextResponse } from "next/server";
import {
  GEMINI_FREE_TIER_WARNING,
  listConfiguredProviders,
  readProviderEnv,
} from "@/lib/ai/provider-config";
import { PRIVATE_HEADERS } from "@/lib/api-headers";

export async function GET() {
  const cfg = readProviderEnv();
  const providers = listConfiguredProviders(cfg);
  return NextResponse.json(
    {
      providers,
      fallbackOrder: cfg.fallbackOrder.filter((id) => providers.some((p) => p.id === id)),
      geminiWarning: GEMINI_FREE_TIER_WARNING,
    },
    { headers: PRIVATE_HEADERS },
  );
}
