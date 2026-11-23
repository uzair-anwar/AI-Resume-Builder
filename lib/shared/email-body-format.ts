/**
 * Plain-text email formatting for textarea, mailto, Gmail compose URLs, and SMTP.
 * Models often return one long paragraph; Gmail compose can also drop breaks if encoding is wrong.
 */
export function formatPlainEmailBody(raw: string): string {
  let t = raw.trim();
  if (!t) return t;

  t = t.replace(/\\n/g, "\n");
  t = t.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  t = t.replace(/\n{3,}/g, "\n\n");

  if (!t.includes("\n\n") && t.split("\n").length <= 1) {
    t = reflowSingleParagraph(t);
  }

  return t.trim();
}

/** Gmail’s compose URL tends to respect CRLF in the body query param. */
export function emailBodyForGmailCompose(body: string): string {
  return formatPlainEmailBody(body).replace(/\n/g, "\r\n");
}

function reflowSingleParagraph(text: string): string {
  let greeting = "";
  let rest = text;

  const greet = rest.match(/^(Hello,|Hi [^,]+,)\s+/i);
  if (greet) {
    greeting = `${greet[1]}\n\n`;
    rest = rest.slice(greet[0].length).trim();
  }

  let signOff = "";
  const close = rest.match(
    /\s+(Best regards,|Best,|Thanks,|Thank you,|Regards,)\s+(.+)$/i,
  );
  if (close && close.index != null) {
    rest = rest.slice(0, close.index).trim();
    signOff = `\n\n${close[1]}\n${close[2]!.trim()}`;
  }

  const sentences = rest.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [rest];
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    paragraphs.push(sentences.slice(i, i + 2).join(" ").trim());
  }

  return `${greeting}${paragraphs.join("\n\n")}${signOff}`.trim();
}