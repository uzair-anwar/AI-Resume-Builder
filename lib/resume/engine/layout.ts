import type { ResumeView } from "@/lib/schemas/resume";
import { LayoutCtx } from "./ctx";
import type { LayoutResult, TemplateSpec } from "./types";

/** Runs a template's layout and returns the display list plus overflow information. */
export function layoutResume(view: ResumeView, spec: TemplateSpec): LayoutResult {
  const ctx = new LayoutCtx(spec);
  spec.layout(view, ctx);
  return ctx.finish();
}
