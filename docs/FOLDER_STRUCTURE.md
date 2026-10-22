# Folder structure

Feature-oriented layout for the Resume Tailor app. Next.js routes stay under `app/`; domain logic lives under `components/`, `lib/`, and `data/`.

## `app/`
- **`page.tsx`** — Home (tailor workspace)
- **`profile/page.tsx`** — Profile overrides UI
- **`api/`** — Route handlers (thin; delegate to `lib/server/*`)

## `components/`
| Folder | Purpose |
|--------|---------|
| **`ui/`** | Shell, loaders, shared cards (`AppShell`, `PageLoader`, `SectionCard`) |
| **`tailor/`** | Job input, progress, ATS chips (`HomeWorkspace`, `TailorProgress`, `JdTermChips`) |
| **`resume/`** | PDF preview, editor, React-PDF document |
| **`cover-letter/`** | Cover letter panel |
| **`profile/`** | Profile editor |

## `data/`
- **`master-resume.json`** — Source of truth for facts, experience, projects
- **`tech-taxonomy.json`**, **`role-families.json`** — ATS / JD vocabulary

## `lib/schemas/`
Zod types shared by API, client, and server (`resume`, `tailoring`, `cover-letter`, …).

## `lib/shared/`
Cross-cutting utilities: `format`, `text-normalize`, `format-headline`, `job-title`, `relevance`, `term-synonym-dedupe`, `api-headers`.

## `lib/resume/`
- **`build-default-resume.ts`** — Default view from master profile
- **`layout/`** — One-page PDF measurement, line budgets, text fit (used by PDF + tailor)

## `lib/client/`
| Folder | Purpose |
|--------|---------|
| **`ai/`** | Provider/model localStorage |
| **`profile/`** | Profile override + contact merge |
| **`session/`** | Draft + tailored session persistence |
| **`tailor/`** | Staged tailor client + pipeline key |
| **`hooks/`** | `useLayoutFonts` |

## `lib/server/`
| Folder | Purpose |
|--------|---------|
| **`ats/`** | JD extract, taxonomy, phrase coverage, ATS score, analyze job |
| **`tailor/`** | Staged AI steps, prompts, validators, project selection |
| **`tailor/tailor-steps/`** | Pipeline, per-step runners, skill ordering |
| **`resume/`** | Assemble view, validate/repair, polish, bullet metrics |
| **`cover-letter/`** | Cover letter generation |
| **`job/`** | URL job extract + board extractors |
| **`ai/`** | LLM providers (Groq, Gemini, …) |
| *(root)* | `safe-fetch`, `text-sanitize`, `layout-fonts`, `log`, `ip-guard` |

## `lib/ai/`
Shared provider config/types used by client and server (non–`server-only`).

## `lib/skills/`
Skill dedupe and resolver.

## `scripts/`
- **`update-imports.mjs`** — Bulk path rewrites after moves
- **`fix-server-imports.mjs`** — Cross-feature server import fixes

## Import alias
All imports use `@/` → project root (`tsconfig.json`).
