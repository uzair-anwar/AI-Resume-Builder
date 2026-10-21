"use client";

import { useCallback, useEffect, useState } from "react";
import type { ResumeView } from "@/lib/schemas/resume";
import type { JobAnalysis, TailorResponse } from "@/lib/schemas/tailoring";
import type { LineBudgets } from "@/lib/layout/budgets";
import { GROQ_MODELS, DEFAULT_GROQ_MODEL } from "@/lib/groq-models";
import { loadSelectedModel, saveSelectedModel } from "@/lib/client/model-storage";
import { loadProfileOverride } from "@/lib/client/profile-storage";
import { loadDraft, saveDraft } from "@/lib/client/session-draft";
import { ResumeEditor } from "./ResumeEditor";
import { ResumePdfPanel } from "./ResumePdfPanel";
import { JdTermChips } from "./JdTermChips";
import Link from "next/link";

export default function HomeWorkspace() {
  const [jobUrl, setJobUrl] = useState(() => loadDraft().jobUrl ?? "");
  const [jobDescription, setJobDescription] = useState(() => loadDraft().jobDescription ?? "");
  const [jobTitle, setJobTitle] = useState(() => loadDraft().jobTitle ?? "");
  const [model, setModel] = useState(() =>
    typeof window === "undefined" ? DEFAULT_GROQ_MODEL : loadSelectedModel(),
  );
  const [resume, setResume] = useState<ResumeView | null>(null);
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [budgets, setBudgets] = useState<LineBudgets | undefined>();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        setResume(data.defaultResume);
        if (data.defaultResume && data.lineBudgets) setBudgets(data.lineBudgets);
      })
      .catch(() => setError("Failed to load profile"));
  }, []);

  useEffect(() => {
    saveDraft({ jobUrl, jobDescription, jobTitle });
  }, [jobUrl, jobDescription, jobTitle]);

  const extractJob = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/extract-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: jobUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Extraction failed");
      setJobDescription(data.description);
      if (data.title) setJobTitle(data.title);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [jobUrl]);

  const tailor = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const override = loadProfileOverride();
      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription,
          jobTitle: jobTitle || undefined,
          model,
          ...(override ? { profileOverride: override } : {}),
        }),
      });
      const data = (await res.json()) as TailorResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Tailoring failed");
      setResume(data.resume);
      setAnalysis(data.analysis);
      setBudgets(data.analysis.lineBudgets);
      setWarnings(data.warnings ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [jobDescription, jobTitle, model]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Resume Tailor</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            One-page resume matched to each job — same layout as your template PDF.
          </p>
        </div>
        <Link href="/profile" className="text-sm underline">
          Profile
        </Link>
      </header>

      {error ? (
        <div className="mb-4 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              Job URL
              <input
                className="mt-1 w-full rounded border px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://boards.greenhouse.io/..."
              />
            </label>
            <button
              type="button"
              disabled={!jobUrl || loading}
              onClick={extractJob}
              className="rounded border px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-600"
            >
              Extract URL
            </button>
            <label className="block text-sm">
              AI model
              <select
                className="mt-1 w-full rounded border px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
                value={model}
                onChange={(e) => {
                  setModel(e.target.value);
                  saveSelectedModel(e.target.value);
                }}
              >
                {GROQ_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm">
            Job description
            <textarea
              className="mt-1 w-full rounded border px-2 py-1.5 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-900"
              rows={10}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </label>

          <label className="block text-sm">
            Job title (for filename)
            <input
              className="mt-1 w-full rounded border px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </label>

          <button
            type="button"
            disabled={jobDescription.length < 50 || loading}
            onClick={tailor}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {loading ? "Working…" : "Tailor resume"}
          </button>

          {analysis ? <JdTermChips analysis={analysis} /> : null}
          {warnings.length ? (
            <ul className="text-xs text-amber-700 dark:text-amber-300">
              {warnings.map((w) => (
                <li key={w}>• {w}</li>
              ))}
            </ul>
          ) : null}

          {resume ? <ResumeEditor resume={resume} onChange={setResume} budgets={budgets} /> : null}
        </div>

        <div>
          {resume ? (
            <ResumePdfPanel
              resume={resume}
              jobTitle={jobTitle}
              analysis={analysis}
              onResumeChange={setResume}
            />
          ) : (
            <p className="sticky top-4 text-sm text-zinc-500">Loading resume preview…</p>
          )}
        </div>
      </div>
    </div>
  );
}
