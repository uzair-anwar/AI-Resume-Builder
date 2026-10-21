import { describe, it, expect } from "vitest";
import { extractJsonLdJobPosting } from "@/lib/server/extractors/jsonld";
import { readFileSync } from "fs";
import path from "path";

describe("jsonld extractor", () => {
  it("extracts JobPosting", () => {
    const html = readFileSync(path.join(process.cwd(), "tests/fixtures/job-jsonld.html"), "utf8");
    const result = extractJsonLdJobPosting(html);
    expect(result?.description).toContain("REST APIs");
    expect(result?.title).toBe("Backend Engineer");
  });
});
