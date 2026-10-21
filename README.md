# Resume Tailor

Personal one-page resume tailoring app. Paste or extract a job description, pick a Groq model in the UI, and get a tailored resume that keeps the same layout as `Uzair_FullStack.pdf`.

## Setup

```bash
npm install
cp .env.example .env.local
```

Add your Groq API key to `.env.local`:

```env
GROQ_API_KEY=gsk_...
```

Get a key at [console.groq.com/keys](https://console.groq.com/keys). Enable Zero Data Retention under Groq Data Controls for personal resume data.

## Run

```bash
npm run dev
```

Open http://localhost:3000

## Commands

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run format
npm run format:check
```

## Notes

- No login or auth — personal use only.
- AI model is chosen in the UI (saved in your browser), not in `.env`.
- Verified profile lives in `data/master-resume.json`. Browser overrides on the Profile page.
- PDF uses bundled PT Serif to match your template.

## Deploy (Vercel)

Import the repo, set `GROQ_API_KEY` in environment variables, deploy (server routes required).
