import { emailBodyForGmailCompose, formatPlainEmailBody } from "@/lib/shared/email-body-format";

/** Opens Gmail's web compose with prefilled fields (attachments must be added manually in Gmail). */
export function buildGmailComposeUrl(opts: {
  to?: string;
  subject?: string;
  body?: string;
}): string {
  const parts = ["view=cm", "fs=1"];
  const to = opts.to?.trim();
  if (to) parts.push(`to=${encodeURIComponent(to)}`);
  if (opts.subject?.trim()) parts.push(`su=${encodeURIComponent(opts.subject.trim())}`);
  if (opts.body?.trim()) {
    const encoded = encodeURIComponent(emailBodyForGmailCompose(opts.body));
    parts.push(`body=${encoded}`);
  }
  return `https://mail.google.com/mail/?${parts.join("&")}`;
}

export function buildMailtoUrl(opts: {
  to?: string;
  subject?: string;
  body?: string;
}): string {
  const params = new URLSearchParams();
  if (opts.subject?.trim()) params.set("subject", opts.subject.trim());
  if (opts.body?.trim()) params.set("body", formatPlainEmailBody(opts.body));
  const q = params.toString();
  const to = encodeURIComponent(opts.to?.trim() ?? "");
  return `mailto:${to}${q ? `?${q}` : ""}`;
}