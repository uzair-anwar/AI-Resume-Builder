"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/ui/AppShell";
import { loadOutreachEmailDraft, type OutreachEmailDraft } from "@/lib/client/outreach/draft-storage";
import { buildGmailComposeUrl, buildMailtoUrl } from "@/lib/client/outreach/gmail-compose";

export default function OutreachComposePage() {
  const [draft, setDraft] = useState<OutreachEmailDraft | null>(null);

  useEffect(() => {
    setDraft(loadOutreachEmailDraft());
  }, []);

  if (!draft) {
    return (
      <AppShell>
        <div className="page-gutter mx-auto max-w-2xl py-10">
          <h1 className="text-2xl font-bold">Compose email</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            No draft found. Generate an application email on the home page first, then click{" "}
            <strong>Open compose helper page</strong>.
          </p>
          <Link href="/" className="btn-primary mt-6 inline-flex">
            Back to tailor
          </Link>
        </div>
      </AppShell>
    );
  }

  const gmailUrl = buildGmailComposeUrl({
    to: draft.to,
    subject: draft.subject,
    body: draft.body,
  });

  return (
    <AppShell>
      <div className="page-gutter mx-auto max-w-2xl space-y-6 py-8">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Send application email</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            You send the message from your own Gmail account. This page keeps your subject and body
            handy while you attach your resume PDF.
          </p>
        </header>

        <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          <li>Download your tailored resume PDF from the home page (if you have not already).</li>
          <li>Click <strong>Open in Gmail</strong> below.</li>
          <li>In Gmail, use the attach (paperclip) control and select your PDF.</li>
          <li>Review and send.</li>
        </ol>

        <div className="glass-panel space-y-3 rounded-2xl p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">To</p>
          <p className="font-mono text-sm">{draft.to || "— (add in Gmail)"}</p>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Subject</p>
          <p className="text-sm font-medium">{draft.subject}</p>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Body</p>
          <pre className="whitespace-pre-wrap rounded-xl border border-zinc-200/80 bg-white/50 p-4 text-sm leading-relaxed dark:border-zinc-700/80 dark:bg-zinc-900/40">
            {draft.body}
          </pre>
          <div className="flex flex-wrap gap-2 pt-2">
            <a
              href={gmailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary !text-sm"
            >
              Open in Gmail
            </a>
            <a
              href={buildMailtoUrl({
                to: draft.to,
                subject: draft.subject,
                body: draft.body,
              })}
              className="btn-ghost !text-sm"
            >
              Default mail app
            </a>
            <button
              type="button"
              className="btn-ghost !text-sm"
              onClick={() => void navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`)}
            >
              Copy subject + body
            </button>
          </div>
        </div>

        <Link href="/" className="btn-ghost inline-flex">
          ← Back to tailor
        </Link>
      </div>
    </AppShell>
  );
}
