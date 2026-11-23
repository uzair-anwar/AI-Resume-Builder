import "server-only";
import nodemailer from "nodemailer";
import { formatPlainEmailBody } from "@/lib/shared/email-body-format";

/** Gmail defaults — only `SMTP_PASS` (App Password) is read from the environment. */
const GMAIL_SMTP = {
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  user: "uzairanwar.online@gmail.com",
  from: "Uzair Anwar <uzairanwar.online@gmail.com>",
} as const;

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
};

export function loadSmtpConfigFromEnv(): SmtpConfig | null {
  const pass = process.env.SMTP_PASS?.trim();
  if (!pass) return null;

  return {
    host: GMAIL_SMTP.host,
    port: GMAIL_SMTP.port,
    secure: GMAIL_SMTP.secure,
    user: GMAIL_SMTP.user,
    from: GMAIL_SMTP.from,
    pass,
  };
}

export function smtpConfigured(): boolean {
  return loadSmtpConfigFromEnv() !== null;
}

function plainToHtml(plain: string): string {
  const escaped = plain
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\n/g, "<br>\n");
}

export async function sendOutreachViaSmtp(opts: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ messageId?: string }> {
  const cfg = loadSmtpConfigFromEnv();
  if (!cfg) {
    throw new Error(
      "SMTP is not configured. Set SMTP_PASS (Gmail App Password) in .env or Vercel.",
    );
  }

  const text = formatPlainEmailBody(opts.body);
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const info = await transporter.sendMail({
    from: cfg.from,
    to: opts.to,
    subject: opts.subject.trim(),
    text,
    html: `<div style="font-family: Arial, sans-serif; font-size: 15px; line-height: 1.55; color: #222;">${plainToHtml(text)}</div>`,
  });

  return { messageId: info.messageId };
}