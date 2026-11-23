import assert from "node:assert/strict";
import test from "node:test";
import {
  outreachBodyQualityIssues,
  sanitizeOutreachBody,
} from "./outreach-body-quality.ts";

test("sanitizeOutreachBody strips URL fragments", () => {
  const raw =
    "Hello,\n\ncom/tabloy/keygate) and was excited by the role.\n\nBest,\nUzair";
  const out = sanitizeOutreachBody(raw);
  assert.ok(!out.includes("com/tabloy"));
  assert.ok(out.includes("Hello,"));
});

test("rejects broken opener", () => {
  const issues = outreachBodyQualityIssues(
    "Hello,\n\ncom/foo) broken\n\nBest,\nUzair Anwar",
    "Uzair Anwar",
  );
  assert.ok(issues.some((i) => i.code === "BODY_URL" || i.code === "BODY_FRAGMENT"));
});