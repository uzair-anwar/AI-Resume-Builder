"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatPlainEmailBody } from "@/lib/shared/email-body-format";
import type { ResumeView } from "@/lib/schemas/resume";
import type { OutreachEmail } from "@/lib/schemas/outreach-email";
import type { JobAnalysis } from "@/lib/schemas/tailoring";
import { buildGmailComposeUrl, buildMailtoUrl } from "@/lib/client/outreach/gmail-compose";
import { saveOutreachEmailDraft } from "@/lib/client/outreach/draft-storage";
import { downloadResumePdf } from "@/lib/client/resume/download-resume-pdf";

type Props = {
  email: OutreachEmail | null;
  loading: boolean;
  onGenerate: () => void;
  onChange: (next: OutreachEmail) => void;
  canGenerate: boolean;
  recipientEmail: string;
  onRecipientEmailChange: (v: string) => void;
  recipientName: string;
  onRecipientNameChange: (v: string) => void;
  resume: ResumeView | null;
  templateId?: string;
  downloadBasename?: string;
  jobTitle?: string;
  analysis?: JobAnalysis | null;
};

export function OutreachEmailPanel({
  email,
  loading,
  onGenerate,
  onChange,
  canGenerate,
  recipientEmail,
  onRecipientEmailChange,
  recipientName,
  onRecipientNameChange,
  resume,
  templateId,
  downloadBasename,
  jobTitle,
  analysis,
}: Props) {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const [smtpReady, setSmtpReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/outreach-email/send")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSmtpReady(Boolean(d?.smtpConfigured)))
      .catch(() => setSmtpReady(false));
  }, []);

  const formattedBody = email ? formatPlainEmailBody(email.body) : "";

  const openGmail = () => {
    if (!email) return;
    const url = buildGmailComposeUrl({
      to: recipientEmail,
      subject: email.subject,
      body: formattedBody,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openComposePage = () => {
    if (!email) return;
    saveOutreachEmailDraft({
      to: recipientEmail,
      recipientName,
      subject: email.subject,
      body: email.body,
      resumeBasename: downloadBasename,
    });
    router.push("/outreach/compose");
  };

  const handleFormatBody = () => {
    if (!email) return;
    onChange({ ...email, body: formatPlainEmailBody(email.body) });
  };

  const handleSendSmtp = async () => {
    if (!email || !recipientEmail.trim()) {
      setSendMessage("Add a recipient email before sending.");
      return;
    }
    setSending(true);
    setSendMessage(null);
    try {
      const res = await fetch("/api/outreach-email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipientEmail.trim(),
          subject: email.subject,
          body: formattedBody,
          recipientName: recipientName.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setSendMessage("Email sent from your SMTP account. Attach the resume in your Sent folder if needed.");
    } catch (e) {
      setSendMessage((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleDownloadResume = async () => {
    if (!resume) return;
    setDownloading(true);
    try {
      await downloadResumePdf(resume, templateId, downloadBasename, { jobTitle, analysis });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Application email</h3>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
            Short cold email from your master and tailored resume. Open in Gmail (with line breaks) or send via
            SMTP if configured in .env. PDF must still be attached manually for now.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary !text-sm"
          disabled={!canGenerate || loading}
          onClick={onGenerate}
        >
          {loading ? "Generating…" : "Generate email"}
        </button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
          To (email)
          <input
            className="input-field font-mono text-xs"
            placeholder="recruiter@company.com"
            value={recipientEmail}
            onChange={(e) => onRecipientEmailChange(e.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Recipient name
          <input
            className="input-field"
            placeholder="e.g. Sarah"
            value={recipientName}
            onChange={(e) => onRecipientNameChange(e.target.value)}
          />
        </label>
      </div>

      {email ? (
        <>
          <label className="mb-3 block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Subject
            <input
              className="input-field font-medium"
              value={email.subject}
              onChange={(e) => onChange({ ...email, subject: e.target.value })}
            />
          </label>
          <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Body
            <textarea
              className="input-field min-h-[12rem] text-sm leading-relaxed"
              value={email.body}
              onChange={(e) => onChange({ ...email, body: e.target.value })}
              onBlur={handleFormatBody}
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn-primary !text-sm" onClick={openGmail}>
              Open in Gmail
            </button>
            {smtpReady ? (
              <button
                type="button"
                className="btn-primary !text-sm"
                disabled={sending || !recipientEmail.trim()}
                onClick={() => void handleSendSmtp()}
              >
                {sending ? "Sending…" : "Send via SMTP"}
              </button>
            ) : null}
            <button type="button" className="btn-ghost !text-sm" onClick={handleFormatBody}>
              Fix paragraph breaks
            </button>
            <button type="button" className="btn-ghost !text-sm" onClick={openComposePage}>
              Open compose helper page
            </button>
            <button
              type="button"
              className="btn-ghost !text-sm"
              disabled={!resume || downloading}
              onClick={() => void handleDownloadResume()}
            >
              {downloading ? "Preparing PDF…" : "Download resume PDF"}
            </button>
            <a
              className="btn-ghost !text-sm"
              href={
                email
                  ? buildMailtoUrl({
                      to: recipientEmail,
                      subject: email.subject,
                      body: formattedBody,
                    })
                  : "#"
              }
            >
              Default mail app
            </a>
          </div>
          {sendMessage ? (
            <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400" role="status">
              {sendMessage}
            </p>
          ) : null}
          {!smtpReady ? (
            <p className="mt-3 text-xs text-zinc-500">
              To send from the app, set <code className="text-[10px]">SMTP_PASS</code> (Gmail App Password) in{" "}
              <code className="text-[10px]">.env</code> or Vercel. Otherwise use Open in Gmail.
            </p>
          ) : (
            <p className="mt-3 text-xs text-zinc-500">
              SMTP is enabled on this server. Download the resume PDF and attach it when replying, or send via Gmail
              after opening compose.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-zinc-500">
          Add a job description (50+ characters). Tailoring first gives the best email copy.
        </p>
      )}
    </div>
  );
}
