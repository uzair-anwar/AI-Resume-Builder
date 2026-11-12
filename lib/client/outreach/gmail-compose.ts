/** Opens Gmail's web compose with prefilled fields (attachments must be added manually in Gmail). */
export function buildGmailComposeUrl(opts: {
  to?: string;
  subject?: string;
  body?: string;
}): string {
  const params = new URLSearchParams({ view: "cm", fs: "1" });
  const to = opts.to?.trim();
  if (to) params.set("to", to);
  if (opts.subject?.trim()) params.set("su", opts.subject.trim());
  if (opts.body?.trim()) params.set("body", opts.body.trim());
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export function buildMailtoUrl(opts: {
  to?: string;
  subject?: string;
  body?: string;
}): string {
  const params = new URLSearchParams();
  if (opts.subject?.trim()) params.set("subject", opts.subject.trim());
  if (opts.body?.trim()) params.set("body", opts.body.trim());
  const q = params.toString();
  const to = encodeURIComponent(opts.to?.trim() ?? "");
  return `mailto:${to}${q ? `?${q}` : ""}`;
}
