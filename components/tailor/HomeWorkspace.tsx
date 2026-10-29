"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ResumeView } from "@/lib/schemas/resume";
import type { JobAnalysis, TailorResponse } from "@/lib/schemas/tailoring";
import type { CoverLetterResponse, CoverLetterVariants } from "@/lib/schemas/cover-letter";
import type { LineBudgets } from "@/lib/resume/layout/budgets";
import type { AiProviderCatalog, AiProviderChoice, AiProviderId } from "@/lib/ai/provider-types";
import { resolveModelPickerProvider } from "@/lib/ai/ui-helpers";
import {
  loadAiProviderChoice,
  loadAllowProviderFallback,
  saveAiProviderChoice,
  saveAllowProviderFallback,
} from "@/lib/client/ai/ai-provider-storage";
import {
  loadAllProviderModels,
  saveModelForProvider,
} from "@/lib/client/ai/ai-model-storage";
import { buildPipelineKey } from "@/lib/client/tailor/pipeline-key";
import { loadProfileOverride } from "@/lib/client/profile/profile-storage";
import { loadDraft, saveDraft } from "@/lib/client/session/session-draft";
import {
  loadStoredTailorSession,
  saveStoredTailorSession,
} from "@/lib/client/session/session-result";
import { defaultResumePdfBasename, shortJobTitleForFilename } from "@/lib/shared/job-title";
import { mergeResumeContactFromMaster } from "@/lib/client/profile/merge-resume-contact";
import { ResumePdfPanel } from "@/components/resume/ResumePdfPanel";
import { JdTermChips } from "@/components/tailor/JdTermChips";
import { CoverLetterPanel } from "@/components/cover-letter/CoverLetterPanel";
import { ApplicationAnswerPanel } from "@/components/tailor/ApplicationAnswerPanel";
import {
  TailorProgress,
  type TailorProgressStepId,
  type TailorStage,
} from "@/components/tailor/TailorProgress";
import { runStagedTailorClient } from "@/lib/client/tailor/staged-tailor";
import type { TailorStepId, TailorStepPrevious } from "@/lib/schemas/tailoring-steps";
import { useLayoutFonts } from "@/lib/client/hooks/use-layout-fonts";
import Link from "next/link";
import { SectionCard } from "@/components/ui/SectionCard";

export default function HomeWorkspace() {
  const [jobUrl, setJobUrl] = useState(() => loadDraft().jobUrl ?? "");
  const [jobDescription, setJobDescription] = useState(() => loadDraft().jobDescription ?? "");
  const [jobTitle, setJobTitle] = useState(() => loadDraft().jobTitle ?? "");
  const [pdfBasename, setPdfBasename] = useState(() => loadDraft().pdfBasename ?? "");
  const pdfBasenameCustom = useRef(Boolean(loadDraft().pdfBasename?.trim()));
  const [provider, setProvider] = useState<AiProviderChoice>(() =>
    typeof window === "undefined" ? "auto" : loadAiProviderChoice(),
  );
  const [allowFallback, setAllowFallback] = useState(() =>
    typeof window === "undefined" ? false : loadAllowProviderFallback(),
  );
  const [serverProviders, setServerProviders] = useState<AiProviderCatalog[]>([]);
  const [fallbackOrder, setFallbackOrder] = useState<AiProviderId[]>([]);
  const [modelsByProvider, setModelsByProvider] = useState<
    Partial<Record<AiProviderId, string>>
  >({});
  const [aiUsage, setAiUsage] = useState<TailorResponse["aiUsage"]>(undefined);
  const [resume, setResume] = useState<ResumeView | null>(null);
  const [analysis, setAnalysis] = useState<JobAnalysis | null>(null);
  const [coverLetter, setCoverLetter] = useState<CoverLetterVariants | null>(null);
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [budgets, setBudgets] = useState<LineBudgets | undefined>();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<TailorStage>("idle");
  const [activeProgressStep, setActiveProgressStep] = useState<TailorProgressStepId | null>(null);
  const [completedProgressSteps, setCompletedProgressSteps] = useState<TailorProgressStepId[]>([]);
  const [viaUrl, setViaUrl] = useState(false);
  const [runId, setRunId] = useState(0);
  const [completedPipelineKey, setCompletedPipelineKey] = useState<string | null>(null);
  const fontsReady = useLayoutFonts();
  const tailorRequestId = useRef(0);
  const restoredFromStorage = useRef(false);

  const pipelineKeyInput = useMemo(
    () => ({
      jobUrl,
      jobDescription,
      provider,
      allowFallback,
      modelsByProvider,
      serverProviders,
    }),
    [jobUrl, jobDescription, provider, allowFallback, modelsByProvider, serverProviders],
  );

  const currentPipelineKey = useMemo(() => {
    if (!serverProviders.length) return null;
    return buildPipelineKey(pipelineKeyInput);
  }, [pipelineKeyInput, serverProviders.length]);

  const inputsStale =
    completedPipelineKey !== null &&
    currentPipelineKey !== null &&
    completedPipelineKey !== currentPipelineKey;

  useEffect(() => {
    if (inputsStale) pdfBasenameCustom.current = false;
  }, [inputsStale]);

  useEffect(() => {
    if (!resume || pdfBasenameCustom.current) return;
    setPdfBasename(
      defaultResumePdfBasename(resume.person.name, {
        jobTitle,
        resumeHeadline: resume.headline,
        detectedTitle: analysis?.detectedTitle,
        hiringCompanyNames: analysis?.hiringCompanyNames,
      }),
    );
  }, [resume, analysis, jobTitle]);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.defaultResume && data.lineBudgets) setBudgets(data.lineBudgets);
        setResume((prev) =>
          prev
            ? mergeResumeContactFromMaster(prev, data.defaultResume.person)
            : data.defaultResume,
        );
      })
      .catch(() => setError("Failed to load profile"));
    fetch("/api/ai-providers")
      .then((r) => r.json())
      .then((data) => {
        const providers = (data.providers ?? []) as AiProviderCatalog[];
        setFallbackOrder(data.fallbackOrder ?? []);
        const ids = providers.map((p) => p.id);
        const models = loadAllProviderModels(ids);
        setModelsByProvider(models);
        setServerProviders(providers);

        const draft = loadDraft();
        const key = buildPipelineKey({
          jobUrl: draft.jobUrl ?? "",
          jobDescription: draft.jobDescription ?? "",
          provider: loadAiProviderChoice(),
          allowFallback: loadAllowProviderFallback(),
          modelsByProvider: models,
          serverProviders: providers,
        });
        const stored = loadStoredTailorSession();
        if (stored?.pipelineKey === key) {
          restoredFromStorage.current = true;
          setCompletedPipelineKey(stored.pipelineKey);
          setJobTitle(stored.jobTitle);
          if (stored.pdfBasename?.trim()) {
            pdfBasenameCustom.current = true;
            setPdfBasename(stored.pdfBasename);
          }
          setResume((prev) =>
            mergeResumeContactFromMaster(stored.resume, prev?.person ?? stored.resume.person),
          );
          setAnalysis(stored.analysis);
          setCoverLetter(stored.coverLetter ?? null);
          setBudgets(stored.budgets ?? stored.analysis.lineBudgets);
          setWarnings(stored.warnings);
          setAiUsage(stored.aiUsage);
          setStage("done");
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    saveDraft({ jobUrl, jobDescription, jobTitle, pdfBasename });
  }, [jobUrl, jobDescription, jobTitle, pdfBasename]);

  const modelPickerProvider = resolveModelPickerProvider(
    provider,
    serverProviders,
    fallbackOrder,
  );
  const modelCatalog = serverProviders.find((p) => p.id === modelPickerProvider);
  const selectedModel =
    (modelPickerProvider && modelsByProvider[modelPickerProvider]) ||
    modelCatalog?.defaultModelId ||
    "";

  const tailor = useCallback(
    async (opts: { description: string; title: string; pipelineKey: string }) => {
      const { description, title, pipelineKey } = opts;
      if (description.length < 50) return;

      const providerModels = Object.fromEntries(
        serverProviders.map((p) => [p.id, modelsByProvider[p.id] ?? p.defaultModelId]),
      ) as Partial<Record<AiProviderId, string>>;

      const requestId = ++tailorRequestId.current;
      setError(null);
      setErrorCode(null);
      setLoading(true);
      setStage("working");
      setCompletedProgressSteps(viaUrl ? ["fetch"] : []);
      const override = loadProfileOverride();

      const refreshPreview = async (previous: TailorStepPrevious, stepWarnings: string[]) => {
        const res = await fetch("/api/tailor/assemble", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobDescription: description,
            previous,
            warnings: stepWarnings,
            ...(override ? { profileOverride: override } : {}),
          }),
        });
        const data = await res.json();
        if (res.ok && requestId === tailorRequestId.current) {
          setResume(data.resume);
          setAnalysis(data.analysis);
          setBudgets(data.analysis.lineBudgets);
        }
      };

      try {
        const staged = await runStagedTailorClient({
          jobDescription: description,
          provider,
          allowProviderFallback: allowFallback,
          providerModels,
          ...(override ? { profileOverride: override } : {}),
          onStepStart: (step: TailorStepId) => setActiveProgressStep(step),
          onStepComplete: async (step, _response, accumulated) => {
            setCompletedProgressSteps((prev) =>
              prev.includes(step) ? prev : [...prev, step],
            );
            await refreshPreview(accumulated, _response.warnings ?? []);
          },
        });

        const accumulated = staged.previous;
        const stepWarnings = [...staged.warnings];
        setActiveProgressStep("assemble");
        const assembleRes = await fetch("/api/tailor/assemble", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobDescription: description,
            previous: accumulated,
            warnings: stepWarnings,
            aiUsage: staged.lastAiUsage,
            ...(override ? { profileOverride: override } : {}),
          }),
        });
        const data = (await assembleRes.json()) as TailorResponse & { error?: string };
        if (requestId !== tailorRequestId.current) return;
        if (!assembleRes.ok) throw new Error(data.error ?? "Tailoring failed");

        setResume(data.resume);
        setAnalysis(data.analysis);
        setCoverLetter(null);
        setBudgets(data.analysis.lineBudgets);
        setWarnings(data.warnings ?? []);
        setAiUsage(data.aiUsage);
        const hiring = data.analysis.hiringCompanyNames;
        const nextTitle = title.trim()
          ? shortJobTitleForFilename(title, { hiringCompanyNames: hiring })
          : shortJobTitleForFilename(data.analysis.detectedTitle, { hiringCompanyNames: hiring });
        if (!title.trim() && nextTitle !== "Resume") setJobTitle(nextTitle);
        pdfBasenameCustom.current = false;
        const basename = defaultResumePdfBasename(data.resume.person.name, {
          jobTitle: title.trim() || nextTitle,
          resumeHeadline: data.resume.headline,
          detectedTitle: data.analysis.detectedTitle,
          hiringCompanyNames: hiring,
        });
        setPdfBasename(basename);
        setCompletedPipelineKey(pipelineKey);
        setCompletedProgressSteps((prev) => [...prev, "assemble", "preview"]);
        setActiveProgressStep(null);
        saveStoredTailorSession({
          pipelineKey,
          jobTitle: title.trim() || nextTitle,
          pdfBasename: basename,
          resume: data.resume,
          analysis: data.analysis,
          budgets: data.analysis.lineBudgets,
          warnings: data.warnings ?? [],
          aiUsage: data.aiUsage,
        });
        setStage("done");
      } catch (e) {
        if (requestId === tailorRequestId.current) {
          setError((e as Error).message);
          setStage("idle");
          setActiveProgressStep(null);
          setCompletedProgressSteps([]);
        }
      } finally {
        if (requestId === tailorRequestId.current) setLoading(false);
      }
    },
    [provider, allowFallback, modelsByProvider, serverProviders, viaUrl],
  );

  const runGenerate = useCallback(async () => {
    if (!currentPipelineKey) return;
    const trimmedUrl = jobUrl.trim();
    const hasUrl = trimmedUrl.length > 0;
    if (!hasUrl && jobDescription.length < 50) {
      setError("Paste a job description (50+ characters) or enter a job URL.");
      return;
    }

    setError(null);
    setErrorCode(null);
    setRunId((n) => n + 1);
    setCompletedProgressSteps([]);
    setActiveProgressStep(null);

    let description = jobDescription;
    let title = jobTitle;

    if (hasUrl) {
      setLoading(true);
      setViaUrl(true);
      setStage("fetching");
      try {
        const res = await fetch("/api/extract-job", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmedUrl }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorCode(typeof data.code === "string" ? data.code : null);
          throw new Error(data.error ?? "Extraction failed");
        }
        description = data.description as string;
        title = shortJobTitleForFilename(data.title);
        setJobDescription(description);
        setJobTitle(title);
      } catch (e) {
        setError((e as Error).message);
        setStage("idle");
        setLoading(false);
        return;
      }
    } else {
      setViaUrl(false);
    }

    const keyAfterExtract = buildPipelineKey({
      ...pipelineKeyInput,
      jobDescription: description,
      jobUrl: trimmedUrl,
    });

    await tailor({ description, title, pipelineKey: keyAfterExtract });
  }, [currentPipelineKey, jobUrl, jobDescription, jobTitle, pipelineKeyInput, tailor]);

  const runGenerateCoverLetter = useCallback(async () => {
    if (jobDescription.length < 50) {
      setError("Paste or extract a job description (50+ characters) before generating a cover letter.");
      return;
    }
    setCoverLetterLoading(true);
    setError(null);
    try {
      const providerModels = Object.fromEntries(
        serverProviders.map((p) => [p.id, modelsByProvider[p.id] ?? p.defaultModelId]),
      ) as Partial<Record<AiProviderId, string>>;
      const override = loadProfileOverride();

      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription,
          jobTitle,
          ...(resume ? { tailoredResume: resume } : {}),
          provider,
          allowProviderFallback: allowFallback,
          providerModels,
          ...(override ? { profileOverride: override } : {}),
        }),
      });
      const data = (await res.json()) as CoverLetterResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Cover letter generation failed");
      setCoverLetter(data.coverLetter);

      const stored = loadStoredTailorSession();
      if (stored) {
        saveStoredTailorSession({
          ...stored,
          coverLetter: data.coverLetter,
        });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCoverLetterLoading(false);
    }
  }, [
    jobDescription,
    jobTitle,
    resume,
    provider,
    allowFallback,
    modelsByProvider,
    serverProviders,
  ]);

  const handleCoverLetterChange = useCallback((next: CoverLetterVariants) => {
    setCoverLetter(next);
    const stored = loadStoredTailorSession();
    if (stored) {
      saveStoredTailorSession({ ...stored, coverLetter: next });
    }
  }, []);

  const canGenerate =
    Boolean(currentPipelineKey) &&
    !loading &&
    (jobUrl.trim().length > 0 || jobDescription.length >= 50);

  const signInNotice = errorCode === "LOGIN_REQUIRED" || errorCode === "BOT_BLOCKED";

  return (
    <div className="page-gutter w-full py-6">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/80 bg-indigo-50/80 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/50 dark:text-indigo-200">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_var(--accent-glow)]" />
            AI-powered tailoring
          </span>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            <span className="text-gradient">Resume Tailor</span>
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            One-page, ATS-aware resume for each job — grounded in your verified profile and template
            layout.
          </p>
        </div>
        <Link href="/profile" className="btn-ghost shrink-0">
          Edit profile
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
        <SectionCard title="Job & AI" subtitle="Paste a URL or description, then tailor in one click.">
        <div className="grid w-full gap-4 md:grid-cols-[minmax(0,1fr)_11rem_14rem] md:items-end">
          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Job URL
            <div className="relative mt-0">
              <input
                className="input-field pr-9"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://boards.greenhouse.io/... or any job board link"
              />
              {jobUrl.trim() ? (
                <button
                  type="button"
                  aria-label="Clear job URL"
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                  onClick={() => setJobUrl("")}
                >
                  <span aria-hidden className="text-lg leading-none">
                    ×
                  </span>
                </button>
              ) : null}
            </div>
          </label>
          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            AI provider
            <select
              className="input-field"
              value={provider}
              onChange={(e) => {
                const v = e.target.value as AiProviderChoice;
                setProvider(v);
                saveAiProviderChoice(v);
              }}
            >
              <option value="auto">Auto (server fallback order)</option>
              {serverProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Model
            {modelPickerProvider && modelCatalog ? (
              <>
                <span className="ml-1 text-xs font-normal text-zinc-500">
                  ({modelCatalog.label}
                  {provider === "auto" ? " · Auto primary" : ""})
                </span>
                <select
                  className="input-field"
                  value={selectedModel}
                  onChange={(e) => {
                    const id = modelPickerProvider;
                    const v = e.target.value;
                    setModelsByProvider((prev) => ({ ...prev, [id]: v }));
                    saveModelForProvider(id, v);
                  }}
                >
                  {modelCatalog.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">Select a configured provider</p>
            )}
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-zinc-200/80 pt-5 dark:border-zinc-700/80">
          <button
            type="button"
            disabled={!canGenerate}
            onClick={() => void runGenerate()}
            className="btn-primary"
          >
            {loading ? "Working…" : jobUrl.trim() ? "Extract job & tailor resume" : "Tailor resume"}
          </button>
          <label className="flex max-w-xl items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={allowFallback}
              onChange={(e) => {
                setAllowFallback(e.target.checked);
                saveAllowProviderFallback(e.target.checked);
              }}
            />
            <span className="text-zinc-600 dark:text-zinc-400">
              Allow fallback if the chosen provider is rate-limited or unavailable.
            </span>
          </label>
        </div>

        {inputsStale ? (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            URL, description, provider, model, or fallback setting changed — click the button above
            to fetch and tailor again.
          </p>
        ) : null}

        {provider === "auto" && serverProviders.length > 1 ? (
          <p className="text-xs text-zinc-500">
            In Auto mode, fallback providers use the model you last chose for each company (saved in
            this browser).
          </p>
        ) : null}

        <label className="mt-5 block w-full text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Job description
          <textarea
            className="input-field font-mono text-xs leading-relaxed"
            rows={8}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste a job description here, or use a URL and click Extract job & tailor resume."
          />
        </label>
        </SectionCard>

        <TailorProgress
          key={runId}
          stage={stage}
          viaUrl={viaUrl}
          activeStep={activeProgressStep}
          completedSteps={completedProgressSteps}
        />

        {resume ? (
          <label className="block max-w-xl text-sm font-medium text-zinc-800 dark:text-zinc-200">
            PDF filename
            <div className="mt-1 flex items-center gap-2">
              <input
                className="input-field font-mono text-xs"
                value={pdfBasename}
                onChange={(e) => {
                  pdfBasenameCustom.current = true;
                  setPdfBasename(e.target.value);
                }}
                placeholder={defaultResumePdfBasename(resume.person.name, {
                  jobTitle,
                  resumeHeadline: resume.headline,
                  detectedTitle: analysis?.detectedTitle,
                  hiringCompanyNames: analysis?.hiringCompanyNames,
                })}
              />
              <span className="shrink-0 text-xs text-zinc-500">.pdf</span>
            </div>
            <span className="mt-1 block text-xs font-normal text-zinc-500">
              Default is your name plus the role title (from the tailored headline or job).
            </span>
          </label>
        ) : null}

        {aiUsage ? (
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Generated with {aiUsage.providerLabel} · {aiUsage.model}
            {aiUsage.usedProviderFallback ? " (fallback provider)" : ""}
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

        {jobDescription.length >= 50 || coverLetter ? (
          <CoverLetterPanel
            coverLetter={coverLetter}
            loading={coverLetterLoading}
            onGenerate={() => void runGenerateCoverLetter()}
            onChange={handleCoverLetterChange}
            canGenerate={!loading && jobDescription.length >= 50}
          />
        ) : null}

        {jobDescription.length >= 50 ? (
          <ApplicationAnswerPanel
            jobDescription={jobDescription}
            jobTitle={jobTitle}
            resume={resume}
            provider={provider}
            allowFallback={allowFallback}
            serverProviders={serverProviders}
            modelsByProvider={modelsByProvider}
            tailorLoading={loading}
          />
        ) : null}

        {!fontsReady ? (
          <SectionCard title="Preview & PDF" subtitle="One-page layout with live PDF export.">
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"
                aria-hidden
              />
              Loading fonts…
            </p>
          </SectionCard>
        ) : resume ? (
          <ResumePdfPanel
            resume={resume}
            jobTitle={jobTitle}
            analysis={analysis}
            budgets={budgets}
            downloadBasename={pdfBasename}
            onResumeChange={setResume}
          />
        ) : (
          <SectionCard title="Preview & PDF" subtitle="One-page layout with live PDF export.">
            <p className="py-16 text-center text-sm text-zinc-500">
              Paste a job description and click <strong className="font-medium">Tailor resume</strong>{" "}
              to generate your one-page PDF (top 3 projects chosen for the JD).
            </p>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
