# Resume Tailor

Personal AI resume tailoring app built with Next.js App Router. Uses a verified master profile (`data/master-resume.json`, seeded from `Uzair_FullStack.pdf`), deterministic gap analysis for any stack (Java, Python, .NET, MERN, etc.), Groq structured outputs, SSRF-safe job URL extraction, and client-side PDF generation.

## Setup

```bash
npm install
cp .env.example .env.local
```

### Groq API key

1. Sign in at [console.groq.com](https://console.groq.com).
2. Create an API key at [console.groq.com/keys](https://console.groq.com/keys) (starts with `gsk_`).
3. Add to `.env.local`:

```env
GROQ_API_KEY=gsk_...
AI_PROVIDER=groq
AI_MODEL=openai/gpt-oss-20b
AI_FALLBACK_MODEL=openai/gpt-oss-120b
```

Enable **Zero Data Retention** under Groq Settings → Data Controls.

For local UI/tests without a key:

```env
AI_PROVIDER=mock
```

Optional access gate (required in production when set):

```env
ACCESS_PASSPHRASE=your-long-passphrase
AUTH_SECRET=random-string-at-least-32-chars
```

## Commands

```bash
npm run dev          # http://localhost:3000
npm run build
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright (uses AI_PROVIDER=mock)
npm run lint
npm run typecheck
```

## Deploy (Vercel)

1. Push this repo to GitHub (private recommended).
2. Import project in Vercel.
3. Add the same environment variables as `.env.local`.
4. Do **not** use static export — API routes are required.

## Data

- Edit verified facts in `data/master-resume.json` or use the Profile page for browser-stored overrides and user-attested skills.
- See `resume-sources/unverified-claims-from-other-pdfs.md` for claims not imported from variant PDFs.

## Security

- Job URL fetching uses SSRF protections (`lib/server/safe-fetch.ts`).
- Private API responses use `Cache-Control: no-store`.
- Resume and job text are not logged.
