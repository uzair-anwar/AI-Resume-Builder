/**
 * Dev helper: extract text from a PDF in the project root.
 * Usage: npx tsx scripts/extract-pdf-text.ts Uzair_FullStack.pdf
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { extractText, getDocumentProxy } from "unpdf";

async function main() {
  const file = process.argv[2] ?? "Uzair_FullStack.pdf";
  const buf = readFileSync(path.join(process.cwd(), file));
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  const outDir = path.join(process.cwd(), "resume-sources");
  mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${path.basename(file, ".pdf")}.txt`);
  writeFileSync(out, text);
  console.log(`Wrote ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
