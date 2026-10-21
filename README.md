# Resume Tailor

**Resume Tailor** helps you turn one master resume into a **job-specific, one-page PDF** that keeps the same look as your template. You give it a job posting (link or pasted text), choose which AI service to use, and it rewrites headlines, summary, skills, and bullet points to match that role—without inventing experience you do not have.

There is **no account or login**. Everything runs in your browser and on your own machine (or your own Vercel site). Your API keys never appear in the page—only on the server.

---

## Who this is for

- **Job seekers** who want a tailored resume per application without rebuilding the layout each time.
- **You (the owner)** who maintain a single verified profile and let AI adjust wording per job description.

If you only want to **use** the app after someone else set it up, skip to [How to use the app](#how-to-use-the-app-everyday-steps).

---

## What the app does (in plain language)

1. **Starts from your real profile** — name, jobs, projects, and facts stored in the app (see Profile in the menu).
2. **Reads the job** — from a job board URL (Greenhouse, Lever, and others when possible) or from text you paste.
3. **Analyzes the posting** — highlights terms that match, are related, or are missing from your background.
4. **Uses AI in five focused steps** (you’ll see each one on the progress bar):
   - **Summary** — job-aligned professional summary from your verified summary facts.
   - **Work experience** — rewrites bullets per role (company titles and dates stay fixed).
   - **Skills** — puts JD-matched skills first, keeps related skills from your profile, and fills the skills block (not just 4–6 items).
   - **Projects** — tailors each project description to the posting.
   - **Headline** — adjusts the line under your name for the role stack (same seniority level; employer job titles are never changed).
5. **Shows a live preview** — the PDF updates as steps finish; edit in the browser, then download (e.g. `Uzair_Anwar_Senior_Engineer.pdf`).

The app **does not** automatically run AI when you type or change settings. You click one button when you are ready. After a successful run, results are **saved in your browser** so a refresh does not call the AI again—until you change the URL, description, AI company, model, or fallback setting.

---

## How to use the app (everyday steps)

### 1. Open the app

- **On your computer:** whoever set up the project runs it locally (see [For developers](#for-developers-setup-and-run)) or hosts it on Vercel; you open the link they give you (often `http://localhost:3000` at home).

### 2. Add the job

Choose **one** of these:

| Option | What to do |
|--------|------------|
| **Job link** | Paste the full URL from the job board into **Job URL**. |
| **Pasted text** | Copy the whole job description into **Job description** (at least a short paragraph). |

You can use both: a URL is fetched first; the text box updates with what was found.

### 3. Choose AI (optional)

- **AI provider** — “Auto” tries providers in a server-defined order. Or pick one company (e.g. Groq, OpenRouter).
- **Model** — dropdown lists safe choices for that company (defaults are fine for most people).
- **Allow fallback** — if checked, the app may switch to another configured provider if the first is busy or rate-limited. Your resume and job text would be sent to that provider too.

You need at least one AI service configured on the server (API keys). If none are set, tailoring falls back to simple rules without AI.

### 4. Run tailoring

Click:

- **Extract job & tailor resume** — when you entered a **Job URL**.
- **Tailor resume** — when you only pasted **Job description** (no URL).

Wait for the progress steps to finish. If something fails (login wall on a job site, blocked bot, etc.), the app shows an error; try pasting the description manually.

### 5. Review and download

- Check **matched / related / missing** chips against the posting.
- Tweak wording in the editor if needed.
- Use the PDF panel to preview and **download** your one-page resume.

### 6. Apply to another job

Change the URL or description (and provider/model if you want), then click the button again. A yellow note appears if your settings changed but you have not re-run yet.

### Profile page

Use **Profile** in the header to adjust your master data in the browser (stored locally). That overrides the default file for future tailoring on this device.

---

## Tips for non-technical users

- **Nothing happens until you click the big button** — changing the model or URL does not spend API credits by itself.
- **Refreshing the page** is safe after a successful run; you should see the same tailored resume if nothing changed.
- **Private job links** or sites that require sign-in may not extract; paste the job text instead.
- **AI can make mistakes** — always read the PDF before sending it to an employer.
- **Free tiers** (Groq, OpenRouter `:free` models, Gemini free tier, etc.) have limits; if you hit errors, wait a bit or ask whoever manages the keys to add another provider.

---

## For developers: setup and run

### Requirements

- [Node.js](https://nodejs.org/) (LTS recommended)
- npm (comes with Node)

### Install

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` and add **at least one** provider. Keys stay server-side only; models are chosen in the UI.

| Provider | Environment variables | Notes |
|----------|----------------------|--------|
| Groq | `GROQ_API_KEY` | [Groq console](https://console.groq.com/keys) |
| OpenRouter | `OPENROUTER_API_KEY` | App only allows `:free` models in the picker |
| Google Gemini | `GEMINI_API_KEY` | Free tier; see Google’s data-use terms |
| Cloudflare Workers AI | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | [Workers AI REST](https://developers.cloudflare.com/workers-ai/get-started/rest-api/) |

Optional in `.env.local`:

- `AI_FALLBACK_ORDER` — comma-separated list for **Auto** mode (default: `groq,openrouter,gemini,cloudflare`).
- `AI_MAX_ELAPSED_MS`, `AI_MAX_ATTEMPTS` — limits for retries (useful on slow serverless timeouts).

### Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other commands

```bash
npm run build      # production build
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm run format     # Prettier write
npm run format:check
npm test           # unit tests (provider config, etc.)
```

### Project layout (short)

- `data/master-resume.json` — default master resume on disk.
- `components/HomeWorkspace.tsx` — main UI (URL, provider, model, generate button, preview).
- `app/api/tailor/step`, `app/api/tailor/assemble`, `app/api/extract-job` — staged AI steps and final layout assembly.
- `lib/server/tailor-steps/` — summary, experience, skills, projects, headline runners.
- `lib/client/session-result.ts` — browser cache of last successful tailor run.

---

## Deploy (Vercel)

1. Import this repository into [Vercel](https://vercel.com).
2. Add the same environment variables as in `.env.local` (Project → Settings → Environment Variables).
3. Deploy. The app needs server routes (`/api/*`); a static-only export is not enough.

On the free Hobby plan, long AI calls may hit time limits; Pro or tuning `AI_MAX_ELAPSED_MS` can help.

---

## Privacy and scope

- Personal tool — **no multi-user auth**.
- Job text and resume content are sent to whichever AI provider you select (and optionally a fallback provider).
- Browser storage: job draft, provider/model choices, and last tailored result (this device only).

---

## License and credits

Built for personal resume tailoring with a fixed PDF template (PT Serif, two-column layout). Adjust `data/master-resume.json` and profile overrides for your own background.
