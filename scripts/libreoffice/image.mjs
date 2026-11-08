#!/usr/bin/env node
// The Linux image of the LibreOffice qualification: the pinned Playwright image, read from the workflow that runs it, so the
// Dockerfile and the CI leg can never name different images (check:playwright-pin keeps every workflow on one string).
//   node scripts/libreoffice/image.mjs            prints the image reference
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const IMAGE = /mcr\.microsoft\.com\/playwright:v\d+\.\d+\.\d+-[a-z]+@sha256:[0-9a-f]{64}/;

export function pinnedImage(workflow = path.join(root, ".github/workflows/nightly.yml")) {
  const match = IMAGE.exec(readFileSync(workflow, "utf8"));
  if (!match) throw new Error(`no pinned Playwright image in ${workflow}`);
  return match[0];
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) console.log(pinnedImage());
