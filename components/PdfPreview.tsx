"use client";

import dynamic from "next/dynamic";
import type { ResumeView } from "@/lib/schemas/resume";
import type { ResumeDensity, ResumeLayout } from "./ResumeDocument";

const PDFViewer = dynamic(() => import("@react-pdf/renderer").then((m) => m.PDFViewer), {
  ssr: false,
  loading: () => <p className="text-sm text-zinc-500">Loading preview…</p>,
});

const ResumeDocument = dynamic(
  () => import("./ResumeDocument").then((m) => m.ResumeDocument),
  { ssr: false },
);

type Props = {
  resume: ResumeView;
  layout: ResumeLayout;
  density: ResumeDensity;
};

export function PdfPreview({ resume, layout, density }: Props) {
  if (typeof window === "undefined") return null;

  return (
    <div className="h-[min(70vh,720px)] w-full overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700">
      <PDFViewer width="100%" height="100%" showToolbar={false} className="border-0">
        <ResumeDocument resume={resume} layout={layout} density={density} />
      </PDFViewer>
    </div>
  );
}
