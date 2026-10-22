# Resume Tailor

**Resume Tailor** helps you turn one master resume into a **job-specific, one-page PDF** that keeps the same look as your template. You give it a job posting (link or pasted text), choose which AI service to use, and it rewrites headlines, summary, skills, bullets, and projects to match that role—without inventing experience you do not have.

There is **no account or login**. Everything runs in your browser and on your own machine (or your own Vercel site). Your API keys never appear in the page—only on the server.

---

## Who this is for

- **Job seekers** who want a tailored resume per application without rebuilding the layout each time.
- **You (the owner)** who maintain a single verified profile and let AI adjust wording per job description.

If you only want to **use** the app after someone else set it up, skip to [How to use the app](#how-to-use-the-app-everyday-steps).

---

## What the app does (in plain language)

1. **Starts from your real profile** — name, jobs, projects, and facts in `data/master-resume.json` (plus optional browser overrides on **Profile**).
2. **Reads the job** — from a job board URL (Greenhouse, Lever, Ashby, and others when possible) or from text you paste.
3. **Analyzes the posting** — JD terms as **matched**, **related**, or **missing**, with an internal **ATS match scorecard** (keywords in narrative, skills, title alignment, structure/metrics).
4. **Uses AI in staged steps** (progress bar):
   - **Summary** — job-aligned summary from verified summary facts.
   - **Work experience** — Google XYZ–style bullets; preserves bullet count per role; prefers **numbers from source facts** and varied opening verbs.
   - **Skills** — JD-matched skills first; gap-fill and exact JD phrasing where allowed.
   - **Projects** — picks the **best 3 projects** for the JD from your full project pool, then tailors each description.
   - **Headline** — short role title (e.g. Forward Deployed Engineer), not JD section headers.
5. **Deterministic polish** — synonym dedupe (JavaScript vs JS), title casing, metric backfill from facts, phrase weaving for ATS, one-page fit (drop low-relevance bullets before chopping text).
6. **Cover letter** (optional) — Standard letter, short LinkedIn/Wellfound note, and talking points grounded in the tailored resume.
7. **Live PDF preview** — edit in the browser, download `Name_RoleTitle.pdf`.

The app **does not** auto-run AI when you change settings. You click one button when ready. After a successful run, results are **saved in your browser** until the URL, description, provider, model, or fallback setting changes.

---

## Recent improvements (changelog)

Highlights from recent development (ATS quality, layout, and UX):

| Area | What changed |
|------|----------------|
| **ATS / JD** | Curated JD phrases, taxonomy (`data/tech-taxonomy.json`), exact-phrase weaving, hiring-company filtering, internal scorecard in the UI |
| **Projects** | Master profile can list **many** projects; each tailor run **selects top 3** by JD relevance and only rewrites those |
| **One-page PDF** | Sentence-aware trim, bullet “widow” handling, richer 2–3 line bullets before aggressive cuts |
| **Headline & copy** | Title case, spaces not hyphens in role titles (Forward Deployed), one canonical name per tech (no JS + JavaScript together) |
| **Experience metrics** | Prompts + post-pass to surface verified counts (APIs, team size, etc.) and diversify bullet verbs |
| **Cover letter** | One-click variants tied to the same job + tailored resume |
| **UI** | Mesh background, glass panels, gradient progress, full-width workspace, feature-grouped components |
| **Repo layout** | Feature folders under `components/*` and `lib/server/{ats,tailor,resume,job,cover-letter}` — see [Folder structure](#folder-structure) |

---

## How to use the app (everyday steps)

### 1. Open the app

- **On your computer:** run locally (see [For developers](#for-developers-setup-and-run)) or open your hosted URL (often `http://localhost:3000`).

### 2. Add the job

| Option | What to do |
|--------|------------|
| **Job link** | Paste the full URL into **Job URL**. |
| **Pasted text** | Copy the job description into **Job description** (at least ~50 characters). |

A URL is fetched first when you use **Extract job & tailor resume**; the text box updates when extraction succeeds.

### 3. Choose AI (optional)

- **AI provider** — **Auto** or a specific vendor (Groq, OpenRouter, Gemini, Cloudflare).
- **Model** — per-provider dropdown (defaults are usually fine).
- **Allow fallback** — may send the same job + profile text to another configured provider if the first fails or is rate-limited.

At least one provider must be configured server-side. Otherwise the app uses **deterministic** reordering (no AI wording).

### 4. Run tailoring

- **Extract job & tailor resume** — when a **Job URL** is set.
- **Tailor resume** — description only.

Watch the progress steps. On extraction errors (login wall, bot block), paste the description manually.

### 5. Review and download

- **ATS insights** — focus label, match rate, keyword chips, score breakdown.
- Edit headline, summary, and bullets if needed.
- **Preview & PDF** — download when the badge shows **1 page**.

Warnings (e.g. which **3 projects** were chosen for this JD) appear under the progress area.

### 6. Cover letter (optional)

After tailoring, generate **Standard**, **Short note**, or **Talking points**; copy or download `.txt`.

### 7. Another job

Change URL or description and run again. A note appears if inputs changed since the last cached run.

### Profile page

**Edit profile** — browser-only JSON overrides and user-attested skills (skills list only; bullets still need verified facts in master data).

---

## Tips for non-technical users

- **Nothing runs until you click the tailor button** — changing model or URL does not spend API credits by itself.
- **Refresh** after a successful run restores the cached result if the pipeline key unchanged.
- **Private or login-only job pages** — paste the description.
- **Always proofread** the PDF before applying.
- **Free API tiers** have rate limits; enable fallback or add another provider in `.env.local`.

---

## For developers: setup and run

### Requirements

- [Node.js](https://nodejs.org/) (LTS)
- npm

### Install

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` with **at least one** provider (keys are server-only):

| Provider | Environment variables |
|----------|----------------------|
| Groq | `GROQ_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Google Gemini | `GEMINI_API_KEY` |
| Cloudflare Workers AI | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` |

Optional: `AI_FALLBACK_ORDER`, `AI_MAX_ELAPSED_MS`, `AI_MAX_ATTEMPTS`.

### Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Commands

```bash
npm run build       # production build
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm run format      # Prettier write
npm test            # unit tests
```

---

## Folder structure

The codebase is organized **by feature**, not by file type. Full detail: **[docs/FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md)**.

```
app/                      # Next.js pages + API routes
components/
  ui/                     # AppShell, loaders, SectionCard
  tailor/                 # Home workspace, progress, ATS chips
  resume/                 # Editor, PDF preview, ResumeDocument
  cover-letter/           # Cover letter panel
  profile/                # Profile editor
data/                     # master-resume.json, tech-taxonomy.json, role-families.json
lib/
  schemas/                # Zod: resume, tailoring, cover-letter, …
  shared/                   # format, normalize, job-title, synonym dedupe
  resume/layout/          # One-page measurement, budgets, text-fit
  client/                   # ai/, profile/, session/, tailor/, hooks/
  server/
    ats/                    # analyze-job, JD extract, phrase coverage, scorecard
    tailor/                 # prompts, validators, pipeline, project-select
    resume/                 # assemble, validate, polish, bullet-metrics
    cover-letter/
    job/                    # extract-job + board extractors
    ai/                     # LLM provider adapters
scripts/                  # import-path helpers after refactors
```

**Import alias:** `@/` → repository root (`tsconfig.json`).

**Key entry points**

| Path | Role |
|------|------|
| `components/tailor/HomeWorkspace.tsx` | Main UI |
| `lib/server/tailor/tailor-steps/pipeline.ts` | End-to-end tailor pipeline |
| `lib/server/tailor/tailoring-workspace.ts` | Master profile + top-3 project slice per JD |
| `lib/server/ats/analyze-job.ts` | JD analysis + line budgets |
| `lib/client/session/session-result.ts` | Browser cache of last tailor run |
| `data/master-resume.json` | Default master resume on disk |

---

## Roadmap / future improvements

Ideas that fit the current architecture but are not fully built yet:

- **UI** — Side-by-side editor + PDF on ultra-wide screens; light/dark theme toggle (today follows system).
- **Projects** — Optional AI tie-break when two projects score similarly; manual pin/exclude projects per application.
- **ATS** — Export Jobscan-style checklist; optional “target score” hints without changing core scoring math.
- **Profile** — Visual project/fact editor instead of JSON-only overrides; import from LinkedIn/PDF (with review).
- **Testing** — More integration tests for `project-select`, `bullet-metrics`, and one-page fit edge cases.
- **Deploy** — Document recommended Vercel timeouts; optional queue for long multi-step AI runs.
- **Repo** — Optional `src/` layout (`src/app`, `src/components`) if you prefer a single source root.
- **i18n** — Multi-language master profiles (headline/summary still English-first for most US JDs).

Contributions welcome; keep master facts truthful and avoid inventing metrics in prompts or polish passes.

---

## Deploy (Vercel)

1. Import the repo into [Vercel](https://vercel.com).
2. Set the same env vars as `.env.local`.
3. Deploy (needs server routes `/api/*`).

Hobby plan may hit function timeouts on long AI chains; tune `AI_MAX_ELAPSED_MS` or use Pro.

---

## Privacy and scope

- Personal tool — **no multi-user auth**.
- Job text and resume content go to the AI provider you select (and optional fallback).
- Browser storage: drafts, provider/model prefs, last tailored result (this device only).

---

## License and credits

Built for personal resume tailoring with a fixed PDF template (PT Serif, two-column layout). Edit `data/master-resume.json` and profile overrides for your own background.
