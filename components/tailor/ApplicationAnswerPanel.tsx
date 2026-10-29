"use client";

import { useState } from "react";
import type { ResumeView } from "@/lib/schemas/resume";
import type { ApplicationAnswerResponse } from "@/lib/schemas/application-answer";
import type { AiProviderCatalog, AiProviderChoice, AiProviderId } from "@/lib/ai/provider-types";
import { loadProfileOverride } from "@/lib/client/profile/profile-storage";

type Props = {
  jobDescription: string;
  jobTitle?: string;
  resume: ResumeView | null;
  provider: AiProviderChoice;
  allowFallback: boolean;
  serverProviders: AiProviderCatalog[];
  modelsByProvider: Partial<Record<AiProviderId, string>>;
  tailorLoading: boolean;
};

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function ApplicationAnswerPanel({
  jobDescription,
  jobTitle,
  resume,
  provider,
  allowFallback,
  serverProviders,
  modelsByProvider,
  tailorLoading,
}: Props) {
  const [open, setOpen] = useState(false);
  const [questionInput, setQuestionInput] = useState("");
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canAsk =
    !tailorLoading &&
    !loading &&
    jobDescription.length >= 50 &&
    questionInput.trim().length >= 5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = questionInput.trim();
    if (q.length < 5 || jobDescription.length < 50) return;

    setLoading(true);
    setError(null);
    setActiveQuestion(q);
    setAnswer(null);

    try {
      const providerModels = Object.fromEntries(
        serverProviders.map((p) => [p.id, modelsByProvider[p.id] ?? p.defaultModelId]),
      ) as Partial<Record<AiProviderId, string>>;
      const override = loadProfileOverride();

      const res = await fetch("/api/application-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          jobDescription,
          jobTitle,
          ...(resume ? { tailoredResume: resume } : {}),
          provider,
          allowProviderFallback: allowFallback,
          providerModels,
          ...(override ? { profileOverride: override } : {}),
        }),
      });
      const data = (await res.json()) as ApplicationAnswerResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Answer generation failed");
      setAnswer(data.answer);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!answer) return;
    await navigator.clipboard.writeText(answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="glass-panel rounded-2xl p-5 sm:p-6">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div>
          <p className="section-label">Application Q&amp;A</p>
          <h2 className="mt-1 text-base font-semibold">Recruiter question coach</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Ask one application question at a time — we tailor an answer from your resume and this
            job description (STAR for behavioral prompts, JD-aligned motivation for &quot;why
            us&quot; questions).
          </p>
        </div>
        <span
          className={`mt-1 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open ? (
        <div className="mt-4 space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
            <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Your question
              <input
                type="text"
                className="input-field mt-1 text-sm"
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                placeholder='e.g. "Why do you want to join our company?" or "Tell me about yourself"'
                maxLength={2000}
              />
            </label>
            <p className="text-xs text-zinc-500">
              One question per request — asking again replaces the previous answer.
              {!resume ? " Tailor your resume first for the strongest evidence." : null}
            </p>
            <button type="submit" disabled={!canAsk} className="btn-primary !px-3.5 !py-1.5 !text-xs">
              {loading ? "Generating tailored answer…" : "Get tailored answer"}
            </button>
          </form>

          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          {activeQuestion ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Question</p>
              <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{activeQuestion}</p>

              <div className="mt-4 flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Tailored answer
                  {answer ? (
                    <span className="ml-2 font-normal normal-case text-zinc-400">
                      ({countWords(answer)} words)
                    </span>
                  ) : null}
                </p>
                {answer ? (
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="btn-ghost !p-1.5"
                    title={copied ? "Copied" : "Copy answer"}
                    aria-label={copied ? "Copied" : "Copy answer"}
                  >
                    {copied ? (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">Copied</span>
                    ) : (
                      <CopyIcon className="h-4 w-4" />
                    )}
                  </button>
                ) : null}
              </div>

              {loading ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
                  <span
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"
                    aria-hidden
                  />
                  Drafting from your resume and the JD…
                </p>
              ) : answer ? (
                <textarea
                  readOnly
                  rows={10}
                  value={answer}
                  className="input-field mt-2 p-2.5 text-sm leading-relaxed"
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
