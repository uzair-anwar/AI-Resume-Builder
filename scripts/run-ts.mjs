#!/usr/bin/env node
/**
 * Dev runner: bundle a TS/TSX script to ESM (packages external) and run it.
 * Needed because @react-pdf/renderer is ESM-friendly only (CJS tsx loading breaks).
 *
 * Usage: node scripts/run-ts.mjs scripts/render-resume.tsx [args...]
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const [entry, ...rest] = process.argv.slice(2);
if (!entry) {
  console.error("usage: run-ts.mjs entry.tsx [args]");
  process.exit(1);
}
const root = process.cwd();
const outDir = mkdtempSync(path.join(tmpdir(), "run-ts-"));
const emptyShim = path.join(outDir, "empty.js");
writeFileSync(emptyShim, "export {};\n");
const outfile = path.join(outDir, "entry.mjs");

await build({
  entryPoints: [path.resolve(entry)],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  jsx: "automatic",
  tsconfig: path.join(root, "tsconfig.json"),
  alias: { "server-only": emptyShim },
  logLevel: "error",
  banner: {
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
});

// External packages resolve from the project's node_modules: run with cwd = project root
// and place the bundle inside the project tree so bare imports resolve.
const local = path.join(root, "node_modules", ".cache-run-ts");
import { mkdirSync, copyFileSync } from "node:fs";
mkdirSync(local, { recursive: true });
const finalFile = path.join(local, `entry-${process.pid}.mjs`);
copyFileSync(outfile, finalFile);
const res = spawnSync(process.execPath, [finalFile, ...rest], {
  stdio: "inherit",
  cwd: root,
  env: { ...process.env, RESUME_FONT_DIR: path.join(root, "public", "fonts") },
});
process.exit(res.status ?? 1);
void pathToFileURL;
