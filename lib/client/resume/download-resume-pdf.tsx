import { pdf } from "@react-pdf/renderer";
import { ResumeDocument } from "@/components/resume/ResumeDocument";
import type { ResumeView } from "@/lib/schemas/resume";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { sanitizePdfDownloadName } from "@/lib/shared/format";
import { defaultResumePdfBasename } from "@/lib/shared/job-title";

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
  const fallback = defaultResumePdfBasename(resume.person.name, {
    jobTitle: opts?.jobTitle,
    resumeHeadline: resume.headline,
    detectedTitle: opts?.analysis?.detectedTitle,
    hiringCompanyNames: opts?.analysis?.hiringCompanyNames,
  });
  a.download = sanitizePdfDownloadName(downloadBasename?.trim() || fallback);
  a.click();
  URL.revokeObjectURL(url);
}
