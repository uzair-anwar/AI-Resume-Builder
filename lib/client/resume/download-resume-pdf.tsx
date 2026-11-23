import { pdf } from "@react-pdf/renderer";
import { ResumeDocument } from "@/components/resume/ResumeDocument";
import type { ResumeView } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { sanitizePdfDownloadName } from "@/lib/shared/format";
import { defaultResumePdfBasename } from "@/lib/shared/job-title";

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function resumePdfFilename(
  resume: ResumeView,
  downloadBasename: string | undefined,
  opts?: { jobTitle?: string; analysis?: JobAnalysis | null },
): string {
  const fallback = defaultResumePdfBasename(resume.person.name, {
    jobTitle: opts?.jobTitle,
    resumeHeadline: resume.headline,
    detectedTitle: opts?.analysis?.detectedTitle,
    hiringCompanyNames: opts?.analysis?.hiringCompanyNames,
  });
  return sanitizePdfDownloadName(downloadBasename?.trim() || fallback);
}

export async function buildResumePdfAttachment(
  resume: ResumeView,
  templateId: string | undefined,
  downloadBasename: string | undefined,
  opts?: { jobTitle?: string; analysis?: JobAnalysis | null },
): Promise<{ filename: string; base64: string }> {
  const blob = await pdf(<ResumeDocument resume={resume} templateId={templateId} />).toBlob();
  return {
    filename: resumePdfFilename(resume, downloadBasename, opts),
    base64: await blobToBase64(blob),
  };
}

export async function downloadResumePdf(
  resume: ResumeView,
  templateId: string | undefined,
  downloadBasename: string | undefined,
  opts?: {
    jobTitle?: string;
    analysis?: JobAnalysis | null;
  },
): Promise<void> {
  const blob = await pdf(<ResumeDocument resume={resume} templateId={templateId} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = resumePdfFilename(resume, downloadBasename, opts);
  a.click();
  URL.revokeObjectURL(url);
}
