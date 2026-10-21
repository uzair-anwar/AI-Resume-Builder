"use client";

import { pdf } from "@react-pdf/renderer";
import { ResumeDocument, type ResumeDensity, type ResumeLayout } from "./ResumeDocument";
import type { ResumeView } from "@/lib/schemas/resume";
import { slugifyFilename } from "@/lib/format";

type Props = {
  resume: ResumeView;
  layout: ResumeLayout;
  density: ResumeDensity;
  jobTitle?: string;
  company?: string;
};

export function DownloadResumeButton({ resume, layout, density, jobTitle, company }: Props) {
  async function download() {
    const blob = await pdf(
      <ResumeDocument resume={resume} layout={layout} density={density} />,
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const name = slugifyFilename([
      resume.person.name.replace(/\s+/g, "_"),
      company ?? "Resume",
      jobTitle ?? resume.headline,
    ]);
    a.href = url;
    a.download = `${name}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={() => download()}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
    >
      Download PDF
    </button>
  );
}
