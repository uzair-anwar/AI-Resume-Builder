import { describe, it, expect } from "vitest";
import { loadMasterResume } from "@/lib/server/master-resume";
import { buildDefaultResumeView } from "@/lib/build-default-resume";
import { estimatePageCount } from "@/lib/estimate-pages";

describe("estimatePageCount", () => {
  it("returns at least 1 for full resume", () => {
    const view = buildDefaultResumeView(loadMasterResume());
    expect(estimatePageCount(view, "normal")).toBeGreaterThanOrEqual(1);
  });
});
