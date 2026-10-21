"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ResumeView } from "@/lib/schemas/resume";
import type { JobAnalysis, TailorResponse } from "@/lib/schemas/tailoring";
import type { LineBudgets } from "@/lib/layout/budgets";
import { GROQ_MODELS, DEFAULT_GROQ_MODEL } from "@/lib/groq-models";
import { loadSelectedModel, saveSelectedModel } from "@/lib/client/model-storage";
import { loadProfileOverride } from "@/lib/client/profile-storage";
import { loadDraft, saveDraft } from "@/lib/client/session-draft";
import { shortJobTitleForFilename } from "@/lib/job-title";
import { ResumeEditor } from "./ResumeEditor";
import { ResumePdfPanel } from "./ResumePdfPanel";
import { JdTermChips } from "./JdTermChips";
import { TailorProgress, type TailorStage } from "./TailorProgress";
import { useLayoutFonts } from "@/lib/client/use-layout-fonts";
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
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<TailorStage>("idle");
  const [viaUrl, setViaUrl] = useState(false);
  const [runId, setRunId] = useState(0);
  const fontsReady = useLayoutFonts();
  const tailorRequestId = useRef(0);
  const lastTailorKey = useRef(`${model}\n${jobDescription}`);
  const tailorRef = useRef<(opts?: { description?: string; title?: string }) => Promise<void>>(
    async () => undefined,
  );

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

  const tailor = useCallback(
    async (opts?: { description?: string; title?: string }) => {
      const description = opts?.description ?? jobDescription;
      const title = opts?.title ?? jobTitle;
      if (description.length < 50) return;

      lastTailorKey.current = `${model}\n${description}`;
      const requestId = ++tailorRequestId.current;
      setError(null);
      setErrorCode(null);
      setLoading(true);
      setStage("tailoring");
      try {
        const override = loadProfileOverride();
        const res = await fetch("/api/tailor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobDescription: description,
            jobTitle: title || undefined,
            model,
            ...(override ? { profileOverride: override } : {}),
          }),
        });
        const data = (await res.json()) as TailorResponse & { error?: string };
        if (requestId !== tailorRequestId.current) return;
        if (!res.ok) throw new Error(data.error ?? "Tailoring failed");
        setResume(data.resume);
        setAnalysis(data.analysis);
        setBudgets(data.analysis.lineBudgets);
        setWarnings(data.warnings ?? []);
        const detected = data.analysis.detectedTitle;
        if (detected) setJobTitle(shortJobTitleForFilename(detected));
        setStage("done");
      } catch (e) {
        if (requestId === tailorRequestId.current) {
          setError((e as Error).message);
          setStage("idle");
        }
      } finally {
        if (requestId === tailorRequestId.current) setLoading(false);
      }
    },
    [jobDescription, jobTitle, model],
  );

  useEffect(() => {
    tailorRef.current = tailor;
  }, [tailor]);

  useEffect(() => {
    if (jobDescription.length < 50) return;
    if (lastTailorKey.current === `${model}\n${jobDescription}`) return;
    const timer = setTimeout(() => {
      setViaUrl(false);
      setRunId((n) => n + 1);
      void tailorRef.current();
    }, 1500);
    return () => clearTimeout(timer);
  }, [jobDescription, model]);

  const extractJob = useCallback(async () => {
    setError(null);
    setErrorCode(null);
    setLoading(true);
    setViaUrl(true);
    setRunId((n) => n + 1);
    setStage("fetching");
    try {
      const res = await fetch("/api/extract-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: jobUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorCode(typeof data.code === "string" ? data.code : null);
        throw new Error(data.error ?? "Extraction failed");
      }

      const description = data.description as string;
      const title = shortJobTitleForFilename(data.title);
      setJobDescription(description);
      setJobTitle(title);
      await tailor({ description, title });
    } catch (e) {
      setError((e as Error).message);
      setStage("idle");
      setLoading(false);
    }
  }, [jobUrl, tailor]);

  const signInNotice = errorCode === "LOGIN_REQUIRED" || errorCode === "BOT_BLOCKED";

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
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
        signInNotice ? (
          <div
            role="alert"
            className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
          >
            <p className="font-medium">
              {errorCode === "LOGIN_REQUIRED" ? "Sign-in required" : "Blocked by the site"}
            </p>
            <p>{error}</p>
          </div>
        ) : (
          <div
            role="alert"
            className="mb-4 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
          >
            {error}
          </div>
        )
      ) : null}

      <div className="flex w-full flex-col gap-6">
        <div className="grid w-full gap-3 md:grid-cols-[minmax(0,1fr)_auto_16rem] md:items-end">
          <label className="block text-sm">
            Job URL
            <input
              className="mt-1 w-full rounded border px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://boards.greenhouse.io/... or any job board link"
            />
          </label>
          <button
            type="button"
            disabled={!jobUrl || loading}
            onClick={() => extractJob()}
            className="rounded border px-4 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-600"
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

        <label className="block w-full text-sm">
          Job description
          <textarea
            className="mt-1 w-full rounded border px-2 py-1.5 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-900"
            rows={8}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          />
        </label>

        <TailorProgress key={runId} stage={stage} viaUrl={viaUrl} />

        {jobTitle ? (
          <p className="text-xs text-zinc-500">
            PDF filename: Uzair_Anwar_{jobTitle.replace(/\s+/g, "_")}
          </p>
        ) : null}

        {analysis ? <JdTermChips analysis={analysis} /> : null}
        {warnings.length ? (
          <ul className="text-xs text-amber-700 dark:text-amber-300">
            {warnings.map((w) => (
              <li key={w}>• {w}</li>
            ))}
          </ul>
        ) : null}

        {resume && fontsReady ? (
          <ResumeEditor resume={resume} onChange={setResume} budgets={budgets} />
        ) : null}

        <div className="w-full">
          {resume && fontsReady ? (
            <ResumePdfPanel
              resume={resume}
              jobTitle={jobTitle}
              analysis={analysis}
              onResumeChange={setResume}
            />
          ) : (
            <p className="text-sm text-zinc-500">Loading resume preview…</p>
          )}
        </div>
      </div>
    </div>
  );
}
