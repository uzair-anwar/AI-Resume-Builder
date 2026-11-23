import { NextResponse } from "next/server";
import { OutreachSendRequestSchema } from "@/lib/schemas/outreach-send";
import { sendOutreachViaSmtp, smtpConfigured } from "@/lib/server/outreach-email/send-smtp";
import { PRIVATE_HEADERS } from "@/lib/shared/api-headers";

export async function GET() {
  return NextResponse.json(
    { smtpConfigured: smtpConfigured() },
    { headers: PRIVATE_HEADERS },
  );
}

export async function POST(req: Request) {
  if (!smtpConfigured()) {
    return NextResponse.json(
      {
        error:
          "SMTP is not configured on the server. Add SMTP_PASS (Gmail App Password) in .env or Vercel environment variables.",
      },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = OutreachSendRequestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid send request" },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  try {
    const result = await sendOutreachViaSmtp(parsed.data);
    return NextResponse.json({ ok: true, messageId: result.messageId }, { headers: PRIVATE_HEADERS });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to send email" },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }
}