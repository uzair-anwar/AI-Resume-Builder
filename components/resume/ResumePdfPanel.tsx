"use client";

import { useEffect, useState, useCallback } from "react";
import { pdf } from "@react-pdf/renderer";
import type { ResumeView } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { ResumeDocument } from "./ResumeDocument";
import { slugifyFilename } from "@/lib/shared/format";
import { shortJobTitleForFilename } from "@/lib/shared/job-title";
import { PDFDocument } from "pdf-lib";
import { fitResumeViewToOnePage } from "@/lib/resume/layout/fit-one-page";

type Props = {
  resume: ResumeView;
  jobTitle?: string;
  analysis?: JobAnalysis | null;
  onResumeChange?: (resume: ResumeView) => void;
};

/** Chrome / Edge PDF viewer: hide thumbnails, fit page to width. */
function pdfPreviewSrc(blobUrl: string): string {
  return `${blobUrl}#navpanes=0&toolbar=0&view=FitH&zoom=page-width`;
}

export function ResumePdfPanel({ resume, jobTitle, analysis, onResumeChange }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setGenerating(true);
      try {
        const blob = await pdf(<ResumeDocument resume={resume} />).toBlob();
        if (cancelled) return;
        const bytes = await blob.arrayBuffer();
        const pdfDoc = await PDFDocument.load(bytes);
        setPageCount(pdfDoc.getPageCount());
        const url = URL.createObjectURL(blob);
        setBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } finally {
        if (!cancelled) setGenerating(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [resume]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  useEffect(() => {
    if (!onResumeChange || pageCount <= 1) return;
    const fitted = fitResumeViewToOnePage(resume, analysis);
    if (JSON.stringify(fitted) !== JSON.stringify(resume)) {
      onResumeChange(fitted);
    }
  }, [pageCount, resume, analysis, onResumeChange]);

  const download = useCallback(async () => {
    const blob = await pdf(<ResumeDocument resume={resume} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const role = shortJobTitleForFilename(jobTitle || analysis?.detectedTitle, {
      hiringCompanyNames: analysis?.hiringCompanyNames,
    });
    a.download = `${slugifyFilename([resume.person.name.replace(/\s+/g, "_"), role])}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }, [resume, jobTitle, analysis]);

  const pageBadge =
    pageCount <= 1 ? (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
        1 page
      </span>
    ) : (
      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800 dark:bg-rose-900 dark:text-rose-200">
        {pageCount} pages — overflow
      </span>
    );

  const previewUrl = blobUrl ? pdfPreviewSrc(blobUrl) : null;

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">PDF preview</h2>
        <div className="flex items-center gap-2">
          {pageBadge}
          {generating ? <span className="text-xs text-zinc-500">Updating…</span> : null}
        </div>
      </div>
      <div
        className="w-full overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-inner dark:border-zinc-700/80 dark:bg-zinc-900"
        style={{ minHeight: "min(92vh, 1056px)" }}
      >
        {previewUrl ? (
          <embed
            type="application/pdf"
            title="Resume PDF preview"
            src={previewUrl}
            className="block h-[min(92vh,1056px)] w-full border-0"
          />
        ) : (
          <p className="flex items-center gap-2 p-6 text-sm text-zinc-500">
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"
              aria-hidden
            />
            Generating preview…
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => download()}
          className="btn-primary"
        >
          Download PDF
        </button>
      </div>
    </div>
  );
}
