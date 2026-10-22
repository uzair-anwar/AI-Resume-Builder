import "server-only";
import type { ExtractedJdTerm } from "./jd-extract";
import { findTaxonomyTermByName, listAllTaxonomyTerms, matchedSurfaces } from "./taxonomy";

/**
 * High-precision phrases: taxonomy + multi-word patterns that ATS tools expect.
 * Runs on full JD text so we do not rely on sliding-window fragments.
 */
export function extractCuratedJdTerms(jobText: string): ExtractedJdTerm[] {
  const out: ExtractedJdTerm[] = [];
  const hay = jobText.replace(/\s+/g, " ");

  for (const t of listAllTaxonomyTerms()) {
    const surfaces = matchedSurfaces(hay, t);
    if (!surfaces.length) continue;
    out.push({
      term: t.canonical,
      surfaceForms: surfaces.slice(0, 3),
      weight: 6,
      section: "required",
    });
  }

  const patterns: { re: RegExp; canonical: string; surface?: string }[] = [
    { re: /\bbackend\s+software\s+engineering(?:\s+experience)?\b/gi, canonical: "Backend Software Engineering" },
    { re: /\bmachine\s+learning\s+models?\b/gi, canonical: "Machine Learning Models" },
    { re: /\b(?:ML\s*Ops|MLOps)\b/gi, canonical: "ML Ops", surface: "ML Ops" },
    { re: /\binfrastructure\s+integration\b/gi, canonical: "Infrastructure Integration" },
    { re: /\bfeature\s+pipelines?\b/gi, canonical: "Feature Pipelines" },
    { re: /\bfraud\s+prevention\b/gi, canonical: "Fraud Prevention" },
    { re: /\bproduct\s+recommendation\b/gi, canonical: "Product Recommendation" },
    { re: /\brecommendation\s+systems?\b/gi, canonical: "Recommendation Systems" },
    { re: /\bpre[- ]sales\b/gi, canonical: "Pre-Sales", surface: "pre-sales" },
    { re: /\bpost[- ]sales\b/gi, canonical: "Post-Sales", surface: "post-sales" },
    { re: /\bhigh[- ]growth\s+startup\b/gi, canonical: "High-Growth Startup" },
    { re: /\bforward[- ]deployed\s+engineer\b/gi, canonical: "Forward Deployed Engineer" },
    { re: /\bproblem[- ]solving\b/gi, canonical: "Problem-Solving" },
    { re: /\banalytical\s+skills?\b/gi, canonical: "Analytical Skills" },
    { re: /\bcommunication\s+skills?\b/gi, canonical: "Communication" },
    { re: /\bteamwork\b/gi, canonical: "Teamwork" },
    { re: /\bstorytelling\b/gi, canonical: "Storytelling" },
    { re: /\bcustomer\s+interaction\b/gi, canonical: "Customer Interaction" },
    { re: /\bcancer\s+detection\b/gi, canonical: "Cancer Detection" },
    { re: /\bchalk\s+infrastructure\b/gi, canonical: "Chalk Infrastructure" },
    { re: /\brust[- ]speed\b/gi, canonical: "Rust" },
    { re: /\bwith\s+rust\b/gi, canonical: "Rust" },
    { re: /\bmachine\s+learning\s+infrastructure\b/gi, canonical: "Machine Learning Infrastructure" },
    { re: /\bcustomer[- ]facing\b/gi, canonical: "Customer-Facing", surface: "customer-facing" },
    { re: /\bcollaboration\s+with\s+sales\b/gi, canonical: "Collaboration With Sales" },
    { re: /\btechnical\s+point\s+of\s+contact\b/gi, canonical: "Technical Point of Contact" },
    { re: /\bpoint\s+of\s+contact\s+pre[- ]sales\b/gi, canonical: "Technical Point of Contact" },
    { re: /\bmicroservices?\s+architecture\b/gi, canonical: "Microservices Architecture" },
    { re: /\brestful\s+apis?\b/gi, canonical: "RESTful APIs" },
    { re: /\bsystem\s+design\b/gi, canonical: "System Design" },
    { re: /\bobservability\b/gi, canonical: "Observability" },
    { re: /\bci\/cd\b/gi, canonical: "CI/CD" },
  ];

  for (const { re, canonical, surface } of patterns) {
    if (!re.test(hay)) continue;
    re.lastIndex = 0;
    const m = re.exec(hay);
    const surf = surface ?? m?.[0]?.trim() ?? canonical;
    if (findTaxonomyTermByName(canonical) || surf) {
      out.push({
        term: findTaxonomyTermByName(canonical)?.canonical ?? canonical,
        surfaceForms: [surf],
        weight: 7,
        section: "required",
      });
    }
  }

  return out;
}
