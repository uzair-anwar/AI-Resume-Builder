import "server-only";

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE = /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g;
const LINKEDIN = /\b(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[^\s]+/gi;

/** Strip contact details from text sent to external AI providers. */
export function redactContactDetails(text: string): string {
  return text.replace(EMAIL, "[email]").replace(PHONE, "[phone]").replace(LINKEDIN, "[linkedin]");
}
