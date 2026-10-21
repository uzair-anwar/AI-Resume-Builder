"use client";

import { useEffect, useState, useCallback } from "react";
import { pdf } from "@react-pdf/renderer";
import type { ResumeView } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { ResumeDocument } from "./ResumeDocument";
import { slugifyFilename } from "@/lib/format";
import { shortJobTitleForFilename } from "@/lib/job-title";
import { PDFDocument } from "pdf-lib";
import { autoFitToOnePage } from "@/lib/layout/autofit";

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

async function countPages(resume: ResumeView): Promise<number> {
  const blob = await pdf(<ResumeDocument resume={resume} />).toBlob();
  const pdfDoc = await PDFDocument.load(await blob.arrayBuffer());
  return pdfDoc.getPageCount();
}

export function ResumePdfPanel({ resume, jobTitle, analysis, onResumeChange }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [fitting, setFitting] = useState(false);

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

  const runAutoFit = useCallback(async () => {
    if (!onResumeChange) return;
    setFitting(true);
    try {
      const fitted = await autoFitToOnePage(resume, analysis, countPages);
      onResumeChange(fitted);
    } finally {
      setFitting(false);
    }
  }, [resume, analysis, onResumeChange]);

  const download = useCallback(async () => {
    const blob = await pdf(<ResumeDocument resume={resume} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const role = shortJobTitleForFilename(jobTitle);
    a.download = `${slugifyFilename([resume.person.name.replace(/\s+/g, "_"), role])}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }, [resume, jobTitle]);

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
        className="w-full overflow-hidden bg-white dark:bg-zinc-900"
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
          <p className="p-4 text-sm text-zinc-500">Generating preview…</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {pageCount > 1 && onResumeChange ? (
          <button
            type="button"
            disabled={fitting || generating}
            onClick={() => runAutoFit()}
            className="rounded-md border border-rose-300 px-4 py-2 text-sm text-rose-800 disabled:opacity-50 dark:border-rose-700 dark:text-rose-200"
          >
            {fitting ? "Auto-fitting…" : "Auto-fit to 1 page"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => download()}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Download PDF
        </button>
      </div>
    </div>
  );
}
