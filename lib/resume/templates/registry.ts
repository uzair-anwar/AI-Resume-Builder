import type { TemplateSpec } from "@/lib/resume/engine/types";
import { FRONTEND_TEMPLATE } from "./frontend";
import { JAVA_TEMPLATE } from "./java";
import { MERN_TEMPLATE } from "./mern";
import { PYTHON_TEMPLATE } from "./python";
import { ROR_TEMPLATE } from "./ror";

export const TEMPLATES: Record<string, TemplateSpec> = {
  [MERN_TEMPLATE.id]: MERN_TEMPLATE,
  [FRONTEND_TEMPLATE.id]: FRONTEND_TEMPLATE,
  [JAVA_TEMPLATE.id]: JAVA_TEMPLATE,
  [PYTHON_TEMPLATE.id]: PYTHON_TEMPLATE,
  [ROR_TEMPLATE.id]: ROR_TEMPLATE,
};

export const DEFAULT_TEMPLATE_ID = MERN_TEMPLATE.id;

export function getTemplate(id?: string | null): TemplateSpec {
  return (id && TEMPLATES[id]) || TEMPLATES[DEFAULT_TEMPLATE_ID]!;
}

export function listTemplates(): TemplateSpec[] {
  return Object.values(TEMPLATES);
}
