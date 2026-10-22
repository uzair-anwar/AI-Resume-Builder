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
    <div className="glass-panel w-full rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="section-label">Outreach</p>
          <h2 className="mt-1 text-base font-semibold">
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
            className="btn-primary !px-3.5 !py-1.5 !text-xs"
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
                className="btn-ghost !text-xs"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                onClick={handleDownloadTxt}
                className="btn-ghost !text-xs"
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
                      ? "bg-indigo-600 text-white shadow-sm dark:bg-indigo-500"
                      : "text-zinc-600 hover:bg-indigo-50 dark:text-zinc-400 dark:hover:bg-indigo-950/40"
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
              className="input-field p-2.5 text-sm leading-relaxed"
            />
          ) : activeTab === "shortMessage" ? (
            <textarea
              rows={5}
              value={coverLetter.shortMessage}
              onChange={(e) => onChange({ ...coverLetter, shortMessage: e.target.value })}
              className="input-field p-2.5 text-sm leading-relaxed"
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
              className="input-field p-2.5 text-sm leading-relaxed"
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
