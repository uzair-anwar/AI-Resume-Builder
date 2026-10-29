import { sanitizeDownloadName } from "@/lib/shared/format";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function coverLetterDownloadStem(companyName: string, tabId: string): string {
  const safeCompany = companyName.replace(/[^A-Za-z0-9_-]+/g, "_");
  return `Cover_Letter_${safeCompany}_${tabId}`;
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCoverLetterTxt(text: string, stem: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  triggerBlobDownload(blob, sanitizeDownloadName(stem, "txt"));
}

export function downloadCoverLetterDoc(text: string, stem: string): void {
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 10pt 0;line-height:1.45;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`,
    )
    .join("");
  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>Cover Letter</title></head>
<body style="font-family:'Times New Roman',serif;font-size:11pt;">${paragraphs}</body>
</html>`;
  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  triggerBlobDownload(blob, sanitizeDownloadName(stem, "doc"));
}
