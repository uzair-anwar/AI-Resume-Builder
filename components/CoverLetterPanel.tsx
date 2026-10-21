"use client";

import { useState } from "react";
import type { CoverLetterVariants } from "@/lib/schemas/cover-letter";

type TabId = "standard" | "shortMessage" | "talkingPoints";

type Props = {
  coverLetter: CoverLetterVariants | null;
  loading: boolean;
  onGenerate: () => void;
  onChange: (next: CoverLetterVariants) => void;
  canGenerate: boolean;
};

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function CoverLetterPanel({
  coverLetter,
  loading,
  onGenerate,
  onChange,
  canGenerate,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("standard");
  const [copied, setCopied] = useState(false);

  const activeText =
    !coverLetter
      ? ""
      : activeTab === "standard"
        ? coverLetter.standard
        : activeTab === "shortMessage"
          ? coverLetter.shortMessage
          : coverLetter.talkingPoints.map((pt) => `• ${pt}`).join("\n");

  const handleCopy = async () => {
    if (!activeText) return;
    await navigator.clipboard.writeText(activeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!activeText || !coverLetter) return;
    const blob = new Blob([activeText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeCompany = coverLetter.companyName.replace(/[^A-Za-z0-9_-]+/g, "_");
    a.href = url;
    a.download = `Cover_Letter_${safeCompany}_${activeTab}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">
            Grounded Cover Letter & Recruiter Outreach
          </h2>
          <p className="text-xs text-zinc-500">
            One-click generation grounded in your tailored resume (Standard Letter, Wellfound/LinkedIn DM, and Interview Talking Points).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canGenerate || loading}
            onClick={onGenerate}
            className="rounded bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {loading
              ? "Generating cover letter…"
              : coverLetter
                ? "Regenerate cover letter"
                : "Generate cover letter (1-click)"}
          </button>
          {coverLetter ? (
            <>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                onClick={handleDownloadTxt}
                className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                Download .txt
              </button>
            </>
          ) : null}
        </div>
      </div>

      {coverLetter ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-700">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "standard", label: "Standard Cover Letter (250–320w)" },
                  { id: "shortMessage", label: "Short Note (Wellfound / LinkedIn DM)" },
                  { id: "talkingPoints", label: "Recruiter Talking Points" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded px-2.5 py-1 text-xs font-medium ${
                    activeTab === tab.id
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-zinc-500">
              Target: {coverLetter.roleTitle} · {coverLetter.companyName} ({countWords(activeText)}{" "}
              words)
            </span>
          </div>

          {activeTab === "standard" ? (
            <textarea
              rows={11}
              value={coverLetter.standard}
              onChange={(e) => onChange({ ...coverLetter, standard: e.target.value })}
              className="w-full rounded border border-zinc-300 p-2.5 text-sm leading-relaxed dark:border-zinc-600 dark:bg-zinc-900"
            />
          ) : activeTab === "shortMessage" ? (
            <textarea
              rows={5}
              value={coverLetter.shortMessage}
              onChange={(e) => onChange({ ...coverLetter, shortMessage: e.target.value })}
              className="w-full rounded border border-zinc-300 p-2.5 text-sm leading-relaxed dark:border-zinc-600 dark:bg-zinc-900"
            />
          ) : (
            <textarea
              rows={7}
              value={coverLetter.talkingPoints.join("\n")}
              onChange={(e) =>
                onChange({
                  ...coverLetter,
                  talkingPoints: e.target.value
                    .split("\n")
                    .map((line) => line.replace(/^[•*-]\s*/, "")),
                })
              }
              className="w-full rounded border border-zinc-300 p-2.5 text-sm leading-relaxed dark:border-zinc-600 dark:bg-zinc-900"
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
