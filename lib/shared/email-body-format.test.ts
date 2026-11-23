import assert from "node:assert/strict";
import test from "node:test";
import { formatPlainEmailBody, emailBodyForGmailCompose } from "./email-body-format.ts";

test("formatPlainEmailBody inserts paragraph breaks for one-line emails", () => {
  const raw =
    "Hello, I saw your role. I built APIs at Acme. I led dashboards there. Best, Uzair Anwar";
  const out = formatPlainEmailBody(raw);
  assert.ok(out.startsWith("Hello,\n\n"));
  assert.ok(out.includes("\n\nBest,"));
});

test("emailBodyForGmailCompose uses CRLF", () => {
  const out = emailBodyForGmailCompose("Hello,\n\nBody.");
  assert.ok(out.includes("\r\n"));
});