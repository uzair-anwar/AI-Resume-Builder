"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ResumeView } from "@/lib/schemas/resume";
import type { JobAnalysis, TailorResponse } from "@/lib/schemas/tailoring";
import type { CoverLetterResponse, CoverLetterVariants } from "@/lib/schemas/cover-letter";
import type { LineBudgets } from "@/lib/layout/budgets";
import type { AiProviderCatalog, AiProviderChoice, AiProviderId } from "@/lib/ai/provider-types";
import { resolveModelPickerProvider } from "@/lib/ai/ui-helpers";
import {
  loadAiProviderChoice,
  loadAllowProviderFallback,
  saveAiProviderChoice,
  saveAllowProviderFallback,
} from "@/lib/client/ai-provider-storage";
import {
  loadAllProviderModels,
  saveModelForProvider,
} from "@/lib/client/ai-model-storage";
import { buildPipelineKey } from "@/lib/client/pipeline-key";
import { loadProfileOverride } from "@/lib/client/profile-storage";
import { loadDraft, saveDraft } from "@/lib/client/session-draft";
import {
  loadStoredTailorSession,
  saveStoredTailorSession,
} from "@/lib/client/session-result";
import { shortJobTitleForFilename } from "@/lib/job-title";
import { mergeResumeContactFromMaster } from "@/lib/client/merge-resume-contact";
import { ResumeEditor } from "./ResumeEditor";
import { ResumePdfPanel } from "./ResumePdfPanel";
import { JdTermChips } from "./JdTermChips";
import { CoverLetterPanel } from "./CoverLetterPanel";
import {
  TailorProgress,
  type TailorProgressStepId,
  type TailorStage,
} from "./TailorProgress";
import { runStagedTailorClient } from "@/lib/client/staged-tailor";
import type { TailorStepId, TailorStepPrevious } from "@/lib/schemas/tailoring-steps";
import { useLayoutFonts } from "@/lib/client/use-layout-fonts";
import Link from "next/link";

export default function HomeWorkspace() {
  const [jobUrl, setJobUrl] = useState(() => loadDraft().jobUrl ?? "");
  const [jobDescription, setJobDescription] = useState(() => loadDraft().jobDescription ?? "");
  const [jobTitle, setJobTitle] = useState(() => loadDraft().jobTitle ?? "");
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
    saveDraft({ jobUrl, jobDescription, jobTitle });
  }, [jobUrl, jobDescription, jobTitle]);

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
        setCompletedPipelineKey(pipelineKey);
        setCompletedProgressSteps((prev) => [...prev, "assemble", "preview"]);
        setActiveProgressStep(null);
        saveStoredTailorSession({
          pipelineKey,
          jobTitle: nextTitle,
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
        <div className="grid w-full gap-3 md:grid-cols-[minmax(0,1fr)_11rem_14rem] md:items-end">
          <label className="block text-sm">
            Job URL
            <input
              className="mt-1 w-full rounded border px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://boards.greenhouse.io/... or any job board link"
            />
          </label>
          <label className="block text-sm">
            AI provider
            <select
              className="mt-1 w-full rounded border px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
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
          <label className="block text-sm">
            Model
            {modelPickerProvider && modelCatalog ? (
              <>
                <span className="ml-1 text-xs font-normal text-zinc-500">
                  ({modelCatalog.label}
                  {provider === "auto" ? " · Auto primary" : ""})
                </span>
                <select
                  className="mt-1 w-full rounded border px-2 py-1.5 dark:border-zinc-600 dark:bg-zinc-900"
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

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!canGenerate}
            onClick={() => void runGenerate()}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {jobUrl.trim() ? "Extract job & tailor resume" : "Tailor resume"}
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

        <label className="block w-full text-sm">
          Job description
          <textarea
            className="mt-1 w-full rounded border px-2 py-1.5 font-mono text-xs dark:border-zinc-600 dark:bg-zinc-900"
            rows={8}
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste a job description here, or use a URL and click Extract job & tailor resume."
          />
        </label>

        <TailorProgress
          key={runId}
          stage={stage}
          viaUrl={viaUrl}
          activeStep={activeProgressStep}
          completedSteps={completedProgressSteps}
        />

        {jobTitle ? (
          <p className="text-xs text-zinc-500">
            PDF filename: Uzair_Anwar_{jobTitle.replace(/\s+/g, "_")}
          </p>
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
