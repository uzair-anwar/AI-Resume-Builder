import { activeProfile } from "./profile";

/** Width (pt) of a full-width text block (summary / skills / project text) in the active template. */
export const columnWidth = (): number => activeProfile().summaryWidth;
/** Body font size (pt) of the active template. */
export const bodySize = (): number => activeProfile().bodySize;
export const bodyLineHeight = (): number => activeProfile().lineHeight;
