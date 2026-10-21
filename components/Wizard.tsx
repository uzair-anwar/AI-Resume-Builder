"use client";

import { useCallback, useEffect, useState } from "react";
import type { ResumeView } from "@/lib/schemas/resume";
import type { TailorResponse } from "@/lib/schemas/tailoring";
import { loadDraft, saveDraft } from "@/lib/client/session-draft";
import { loadProfileOverride } from "@/lib/client/profile-storage";
import { PdfPreview } from "./PdfPreview";
import { DownloadResumeButton } from "./DownloadResumeButton";
import { ResumeEditor } from "./ResumeEditor";
import { RequirementsPanel } from "./RequirementsPanel";
import { ChangesPanel } from "./ChangesPanel";
import type { ResumeDensity, ResumeLayout } from "./ResumeDocument";
import { estimatePageCount } from "@/lib/estimate-pages";

type RoleFamily = { id: string; label: string };

export function Wizard() {
  const initialDraft = typeof window !== "undefined" ? loadDraft() : {};
  const [step, setStep] = useState(0);
  const [jobUrl, setJobUrl] = useState(initialDraft.jobUrl ?? "");
  const [jobDescription, setJobDescription] = useState(initialDraft.jobDescription ?? "");
  const [jobTitle, setJobTitle] = useState(initialDraft.jobTitle ?? "");
  const [roleFamilies, setRoleFamilies] = useState<RoleFamily[]>([]);
  const [roleFamilyId, setRoleFamilyId] = useState<string>(initialDraft.roleFamilyId ?? "");
  const [defaultResume, setDefaultResume] = useState<ResumeView | null>(null);
  const [resume, setResume] = useState<ResumeView | null>(null);
  const [tailorResult, setTailorResult] = useState<TailorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [layout, setLayout] = useState<ResumeLayout>("two-column");
  const [density, setDensity] = useState<ResumeDensity>("normal");
  const [targetPages, setTargetPages] = useState(1);

  useEffect(() => {
    saveDraft({ jobUrl, jobDescription, jobTitle, roleFamilyId });
  }, [jobUrl, jobDescription, jobTitle, roleFamilyId]);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        setDefaultResume(data.defaultResume);
        setRoleFamilies(data.roleFamilies ?? []);
        setResume((prev) => prev ?? data.defaultResume);
      })
      .catch(() => setError("Failed to load profile"));
  }, []);

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
      setStep(0);
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
          roleFamilyId: roleFamilyId || undefined,
          ...(override ? { profileOverride: override } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Tailoring failed");
      setTailorResult(data);
      setResume(data.resume);
      if (data.analysis?.roleFamilyId) setRoleFamilyId(data.analysis.roleFamilyId);
      setStep(2);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [jobDescription, jobTitle, roleFamilyId]);

  const pages = resume ? estimatePageCount(resume, density) : 1;
  const pageWarning = pages > targetPages;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Resume Tailor</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Tailor your verified profile to any job stack — without inventing experience.
          </p>
        </div>
        <nav className="flex gap-3 text-sm">
          <a href="/profile" className="text-zinc-600 underline dark:text-zinc-300">Profile</a>
        </nav>
      </header>

      <ol className="flex gap-2 text-sm">
        {["Job", "Analyze", "Edit & PDF"].map((label, i) => (
          <li
            key={label}
            className={`rounded-full px-3 py-1 ${step === i ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800"}`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {step === 0 && (
        <section className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              Job URL
              <input
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
                placeholder="https://boards.greenhouse.io/..."
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                disabled={loading || !jobUrl}
                onClick={extractJob}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-zinc-600"
              >
                Extract from URL
              </button>
            </div>
          </div>
          <label className="block text-sm">
            Job description (paste or edit after extraction)
            <textarea
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-900"
              rows={14}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </label>
          <label className="block text-sm md:max-w-md">
            Job title (optional)
            <input
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </label>
          <label className="block text-sm md:max-w-md">
            Role family override
            <select
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-900"
              value={roleFamilyId}
              onChange={(e) => setRoleFamilyId(e.target.value)}
            >
              <option value="">Auto-detect</option>
              {roleFamilies.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={loading || jobDescription.length < 50}
            onClick={() => {
              setStep(1);
              tailor();
            }}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Analyze & tailor
          </button>
        </section>
      )}

      {step === 1 && loading && (
        <p className="text-sm text-zinc-500">Running gap analysis and AI tailoring…</p>
      )}

      {step === 1 && tailorResult && !loading && (
        <section className="space-y-4">
          <RequirementsPanel analysis={tailorResult.analysis} />
          {tailorResult.warnings?.length ? (
            <ul className="text-sm text-amber-700 dark:text-amber-300">
              {tailorResult.warnings.map((w) => (
                <li key={w}>• {w}</li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            className="text-sm underline"
            onClick={() => setStep(2)}
          >
            Continue to editor
          </button>
        </section>
      )}

      {step === 2 && resume && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            {tailorResult ? <RequirementsPanel analysis={tailorResult.analysis} /> : null}
            <ResumeEditor resume={resume} onChange={setResume} />
            <ChangesPanel changes={tailorResult?.changes ?? []} />
            <div className="flex flex-wrap gap-3 items-center">
              <label className="text-sm">
                Layout
                <select
                  className="ml-2 rounded border px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                  value={layout}
                  onChange={(e) => setLayout(e.target.value as ResumeLayout)}
                >
                  <option value="two-column">Two column</option>
                  <option value="single-column">ATS single column</option>
                </select>
              </label>
              <label className="text-sm">
                Density
                <select
                  className="ml-2 rounded border px-2 py-1 dark:border-zinc-600 dark:bg-zinc-900"
                  value={density}
                  onChange={(e) => setDensity(e.target.value as ResumeDensity)}
                >
                  <option value="normal">Normal</option>
                  <option value="compact">Compact</option>
                </select>
              </label>
              <span className={`text-sm ${pageWarning ? "text-amber-600" : "text-zinc-500"}`}>
                ~{pages} page(s){pageWarning ? ` — exceeds target of ${targetPages}` : ""}
              </span>
              <label className="text-sm">
                Target pages
                <input
                  type="number"
                  min={1}
                  max={2}
                  className="ml-2 w-12 rounded border px-1 dark:border-zinc-600 dark:bg-zinc-900"
                  value={targetPages}
                  onChange={(e) => setTargetPages(Number(e.target.value))}
                />
              </label>
            </div>
            <DownloadResumeButton
              resume={resume}
              layout={layout}
              density={density}
              jobTitle={jobTitle}
              company={tailorResult?.analysis.detectedTitle}
            />
            <button
              type="button"
              className="text-sm underline"
              onClick={() => {
                setResume(defaultResume);
                setStep(0);
              }}
            >
              Start over
            </button>
          </div>
          <PdfPreview resume={resume} layout={layout} density={density} />
        </section>
      )}
    </div>
  );
}
