import { describe, it, expect } from "vitest";
import { loadMasterResume } from "@/lib/server/master-resume";
import { analyzeJob } from "@/lib/server/analyze-job";

describe("analyzeJob", () => {
  const resume = loadMasterResume();

  it("detects Java family and marks Java missing", () => {
    const jd = `
      Senior Java Developer
      Requirements:
      - 5 years Java and Spring Boot
      - REST APIs
      - PostgreSQL
    `;
    const a = analyzeJob(jd, resume, "java");
    expect(a.roleFamilyId).toBe("java");
    const javaGap = a.gapAnalysis.find((g) => g.requirement.toLowerCase().includes("java"));
    expect(javaGap?.status).toBe("missing");
  });

  it("detects Python family with matched Python", () => {
    const jd = "Python Django developer with REST APIs";
    const a = analyzeJob(jd, resume, "python");
    expect(a.roleFamilyId).toBe("python");
    expect(a.coverage.matched).toBeGreaterThan(0);
  });

  it("detects dotnet family and flags csharp gap", () => {
    const jd = "C# .NET Core ASP.NET developer";
    const a = analyzeJob(jd, resume, "dotnet");
    expect(a.roleFamilyId).toBe("dotnet");
    const csharp = a.gapAnalysis.find((g) => g.requirement.toLowerCase().includes("c#"));
    expect(["missing", "transferable"]).toContain(csharp?.status);
  });
});
