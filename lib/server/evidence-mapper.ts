import "server-only";
import type { MasterResume } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import {
  findTaxonomyTermByName,
  findTermInText,
  loadTaxonomy,
  type TaxonomyTerm,
} from "./taxonomy";

type FactItem = MasterResume["summaryFacts"][number];

/**
 * How freely the model may rewrite a bullet (mirrors Resume-Matcher's nudge / keywords / heavy tiers):
 * - weave:   the fact already contains JD terms. Keep its meaning, rephrase to surface them.
 * - bridge:  the fact supports JD concepts under different wording. Re-word toward those concepts.
 * - reframe: no JD overlap. The bullet may be fully rewritten around the angle of this role that is
 *            most relevant to the JD, using only verified facts/skills (never new tools or numbers).
 */
export type RewriteMode = "weave" | "bridge" | "reframe" | "polish";

export type FactEvidenceAnnotation = {
  factId: string;
  directKeywords: string[];
  bridgedPhrases: string[];
  rewriteMode: RewriteMode;
  hasMetrics: boolean;
};

/**
 * Fact text signals -> JD concepts the fact can legitimately support. Concept names must equal
 * taxonomy canonical names so they line up with JD chips.
 */
const CONCEPT_HINT_PATTERNS: { re: RegExp; concepts: string[] }[] = [
  {
    // Building server-side services / APIs (not merely consuming someone else's API).
    re: /\b(microservices?|backend|back-end|server-side|services)\b|\b(designed|built|created|developed)\s+[\w.\- ]{0,25}\bapis?\b/i,
    concepts: ["Microservices", "REST APIs", "API Design", "System Design"],
  },
  {
    re: /\b(distributed|microservices?|multiple services|serverless|event-driven|queues?)\b/i,
    concepts: ["Distributed Systems", "Scalability"],
  },
  {
    re: /\b(integrat\w*|third-party|external (data|apis?|systems?)|webhooks?|connectors?|data exchange)\b/i,
    concepts: ["Third-Party Integrations", "API Design"],
  },
  {
    re: /\b(aws|azure|gcp|cloud|serverless|lambda|amplify|appsync|cognito|cdk|ec2|s3)\b/i,
    concepts: ["Cloud Infrastructure", "Serverless"],
  },
  {
    re: /\b(ci\/cd|pipelines?|deployments?|releases?|github actions|gitlab|jenkins)\b/i,
    concepts: ["CI/CD", "Reliability"],
  },
  {
    re: /\b(monitor\w*|logging|alerts?|alerting|telemetry|tracing|metrics|cloudwatch|datadog|sentry|observab\w*)\b/i,
    concepts: ["Observability"],
  },
  {
    re: /\b(uptime|reliab\w*|availability|resilien\w*|fault[- ]toleran\w*|incident|production support|stability)\b/i,
    concepts: ["Reliability"],
  },
  {
    re: /\b(latency|throughput|optimiz\w*|performance|speed(ed)?|faster|efficien\w*|scal(e|ed|able|ing|ability))\b/i,
    concepts: ["Performance Optimization", "Scalability", "Reliability"],
  },
  {
    re: /\b(redis|cache|caching)\b/i,
    concepts: ["Caching"],
  },
  {
    re: /\b(led|lead|leading|mentor\w*|pairing|onboard\w*|coach\w*|guidance)\b/i,
    concepts: ["Leadership", "Team Building"],
  },
  {
    re: /\b(cross-functional|stakeholders?|collaborat\w*|distributed teams?|code reviews?|reviews)\b/i,
    concepts: ["Team Building", "Code Quality"],
  },
  {
    re: /\b(agile|scrum|sprints?|kanban)\b/i,
    concepts: ["Agile"],
  },
  {
    re: /\b(sql|postgres\w*|mysql|database|databases|schema|queries|transactions?)\b/i,
    concepts: ["SQL", "Data Modeling"],
  },
  {
    re: /\b(mongo\w*|dynamodb|redis|nosql|document stores?)\b/i,
    concepts: ["NoSQL"],
  },
  {
    re: /\b(etl|pipelines?|ingest\w*|centralized platforms?|data sources?|data exchange)\b/i,
    concepts: ["ETL"],
  },
  {
    re: /\b(dashboards?|analytics|visuali[sz]\w*|reporting|business intelligence|operational visibility)\b/i,
    concepts: ["Data Visualization"],
  },
  {
    re: /\b(auth\w*|oauth|jwt|rbac|security|compliance|encrypt\w*|hipaa)\b/i,
    concepts: ["Security & Compliance"],
  },
  {
    re: /\b(unit tests?|integration tests?|test coverage|automated tests?|jest|pytest|qa)\b/i,
    concepts: ["Automated Testing", "Code Quality"],
  },
  {
    re: /\b(events?|event-driven|queues?|async\w*|sqs|sns|kafka|pub\/sub|streams?)\b/i,
    concepts: ["Event-Driven Architecture", "Message Queues"],
  },
  {
    re: /\b(real-time|realtime|websockets?|streaming)\b/i,
    concepts: ["Real-Time Systems"],
  },
  {
    re: /\b(workflows?|automat\w*)\b/i,
    concepts: ["Workflow Automation"],
  },
  {
    re: /\b(financ\w*|loans?|mortgage|payments?|fintech|market data|banking|money)\b/i,
    concepts: ["Payment Systems"],
  },
  {
    re: /\b(healthcare|pharmacy|clinical|patients?|benefit management|provider workflows|health)\b/i,
    concepts: ["Healthcare Systems"],
  },
  {
    re: /\b(design to deployment|end-to-end|owned|ownership|from design|own features)\b/i,
    concepts: ["End-to-End Ownership"],
  },
  {
    re: /\b(saas|multi-tenant|tenants?|client management)\b/i,
    concepts: ["Multi-Tenancy"],
  },
  {
    re: /\b(ai|llms?|gpt|openai|agentic|heygen|machine learning|prompts?|generative)\b/i,
    concepts: ["LLM", "Prompt Engineering"],
  },
  {
    re: /\b(ui|ux|react(\.js)?|redux|state management|context api|frontend|front-end|components?)\b/i,
    concepts: ["State Management"],
  },
  {
    re: /\b(architecture|architectural|design decisions?|reusable|refactor\w*|modular)\b/i,
    concepts: ["System Design", "Code Quality"],
  },
];

function isConceptLike(term: string): boolean {
  const tax = findTaxonomyTermByName(term);
  return tax?.kind === "concept" || tax?.kind === "soft";
}

/** Taxonomy terms that appear in this fact (text or declared skills). */
function taxonomyTermsInFact(hay: string): TaxonomyTerm[] {
  return loadTaxonomy().terms.filter((t) => findTermInText(hay, t));
}

/** Taxonomy ids that share a transferable group with `termId`. */
function groupPeers(termId: string): Set<string> {
  const peers = new Set<string>();
  for (const g of loadTaxonomy().transferableGroups) {
    if (!g.terms.includes(termId)) continue;
    for (const t of g.terms) if (t !== termId) peers.add(t);
  }
  return peers;
}

/**
 * Deterministically maps a single resume fact to the JD keywords and terminology bridges
 * it can legitimately support, so the LLM knows exactly which JD terms to weave into each bullet.
 */
export function mapFactToJdEvidence(
  fact: FactItem,
  analysis: JobAnalysis,
  _resume?: MasterResume,
): FactEvidenceAnnotation {
  const hay = `${fact.text} ${(fact.skills ?? []).join(" ")}`.toLowerCase();
  const inFactTerms = taxonomyTermsInFact(hay);

  const directKeywords: string[] = [];
  const bridgedPhrases: string[] = [];
  const bridgedTerms = new Set<string>();

  const addBridge = (term: string, via?: string, isTool = false) => {
    if (bridgedTerms.has(term.toLowerCase())) return;
    bridgedTerms.add(term.toLowerCase());
    if (isTool && via) {
      // Never let the model claim a tool the candidate hasn't used: describe the verified equivalent.
      bridgedPhrases.push(`${term} [describe the verified ${via} work; do NOT name ${term}]`);
    } else {
      bridgedPhrases.push(via ? `${term} (via ${via})` : term);
    }
  };

  for (const chip of analysis.terms) {
    const termLower = chip.term.toLowerCase();
    const taxTerm = findTaxonomyTermByName(chip.term);
    const isTool = taxTerm ? (taxTerm.kind ?? "tool") === "tool" : false;
    const direct =
      chip.status === "matched" &&
      (hay.includes(termLower) || (taxTerm ? findTermInText(hay, taxTerm) : false));

    if (direct) {
      directKeywords.push(chip.term);
      continue;
    }

    if (chip.status === "related") {
      const viaInFact = chip.relatedVia && hay.includes(chip.relatedVia.toLowerCase());
      let peerHit: string | undefined;
      if (taxTerm) {
        const peers = groupPeers(taxTerm.id);
        const hit = inFactTerms.find((t) => peers.has(t.id));
        peerHit = hit?.canonical;
      }
      if (viaInFact || peerHit) {
        addBridge(chip.term, peerHit ?? chip.relatedVia, isTool);
      }
    }
  }

  // Concept / soft-skill hints. Concepts are never "unverified tools", so even JD concepts the profile
  // does not literally state (status "missing") may be bridged when the fact's content supports them.
  const conceptChips = analysis.terms.filter(
    (t) => t.status !== "missing" || isConceptLike(t.term),
  );
  // Concept hints read the bullet's own wording only (not its skill tags), so a "REST APIs" tag
  // cannot make an unrelated dashboard bullet claim microservices.
  const textHay = fact.text.toLowerCase();
  for (const rule of CONCEPT_HINT_PATTERNS) {
    if (!rule.re.test(textHay)) continue;
    for (const concept of rule.concepts) {
      const chip = conceptChips.find((t) => t.term.toLowerCase() === concept.toLowerCase());
      if (!chip || !isConceptLike(chip.term)) continue;
      if (directKeywords.includes(chip.term)) continue;
      if (chip.status === "matched") {
        // Verified on the profile and supported by this fact's domain: safe to surface here.
        directKeywords.push(chip.term);
        continue;
      }
      addBridge(chip.term);
    }
  }

  const hasMetrics = /\d/.test(fact.text) || Boolean(fact.metricsVerified);
  const direct = directKeywords.slice(0, 6);
  const bridged = bridgedPhrases.slice(0, 5);
  const rewriteMode: RewriteMode = direct.length ? "weave" : bridged.length ? "bridge" : "reframe";

  return {
    factId: fact.id,
    directKeywords: direct,
    bridgedPhrases: bridged,
    rewriteMode,
    hasMetrics,
  };
}

const REWRITE_GUIDANCE: Record<RewriteMode, string> = {
  weave: "Rewrite: keep the meaning, rephrase to surface the keywords",
  bridge: "Rewrite: re-word toward the bridge terms, same underlying work",
  reframe:
    "Rewrite: LOW JD overlap, you MAY rewrite fully around this role's most JD-relevant angle using only this role's verified facts/skills",
  polish: "Rewrite: no JD terms apply, keep the original meaning and only tighten the wording (strong verb, clear outcome)",
};

/**
 * Caps full rewrites: at most ~1/3 of a role's bullets (min 1) may be "reframe"; the rest of the
 * low-overlap bullets are downgraded to "polish" so a role is never rewritten wholesale.
 */
export function planRewriteModes(
  facts: FactItem[],
  analysis: JobAnalysis,
): Map<string, RewriteMode> {
  const modes = new Map<string, RewriteMode>();
  const reframeIds: string[] = [];
  for (const f of facts) {
    const mode = mapFactToJdEvidence(f, analysis).rewriteMode;
    modes.set(f.id, mode);
    if (mode === "reframe") reframeIds.push(f.id);
  }
  const maxReframe = Math.max(1, Math.floor(facts.length / 3));
  // Prefer to reframe bullets that carry no numbers (nothing to lose); keep role order otherwise.
  const withoutNumbers = reframeIds.filter(
    (id) => !/\d/.test(facts.find((f) => f.id === id)?.text ?? ""),
  );
  const keep = new Set([...withoutNumbers, ...reframeIds].slice(0, maxReframe));
  for (const id of reframeIds) if (!keep.has(id)) modes.set(id, "polish");
  return modes;
}

export function formatFactWithEvidence(
  fact: FactItem,
  analysis: JobAnalysis,
  maxLines?: number,
  redactedText?: string,
  includeRewriteMode = false,
  modeOverride?: RewriteMode,
): string {
  const ev = mapFactToJdEvidence(fact, analysis);
  const hints: string[] = [];
  if (ev.directKeywords.length) {
    hints.push(`JD keywords to include: ${ev.directKeywords.join(", ")}`);
  }
  if (ev.bridgedPhrases.length) {
    hints.push(`Terminology bridge: ${ev.bridgedPhrases.join(", ")}`);
  }
  if (includeRewriteMode) {
    hints.push(REWRITE_GUIDANCE[modeOverride ?? ev.rewriteMode]);
    if (ev.hasMetrics) hints.push("has metrics — lead bullet with XYZ measured-by clause");
  }
  const lineTag = maxLines ? `max ~${maxLines} lines` : "";
  const meta = [lineTag, ...hints].filter(Boolean).join(" | ");
  const text = redactedText ?? fact.text;
  return meta ? `${fact.id} [${meta}]: ${text}` : `${fact.id}: ${text}`;
}
