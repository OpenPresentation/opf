#!/usr/bin/env node
// RR-28: `opf-preview-fonts <outDir> [--scripts all|Jpan,Arab]` fills a self-hosted font root for <opf-deck>.
import { copyPreviewFonts } from "./preview-fonts-node.js";

const args = process.argv.slice(2);
const flag = (name) => { const at = args.indexOf(name); return at === -1 ? undefined : args[at + 1]; };
const outDir = args.find((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--scripts");
if (!outDir || args.includes("--help")) {
  console.error("Usage: opf-preview-fonts <outDir> [--scripts all|Jpan,Arab,...]\nCopies the pinned, license-verified preview fonts to <outDir> (serve it as <opf-deck fonts=\"/<outDir>/\">).");
  process.exit(outDir ? 0 : 2);
}
const scripts = flag("--scripts");
const result = copyPreviewFonts({ outDir, scripts: scripts === undefined ? false : scripts === "all" ? "all" : scripts.split(",").map((code) => code.trim()).filter(Boolean) });
console.log(`Preview fonts: ${result.packages} packages, ${result.copied} copied, ${result.verified} already verified, ${(result.bytes / 1048576).toFixed(1)} MiB, all SHA-256 verified.`);
if (result.missing.length) console.warn(`Not installed (script faces skipped): ${result.missing.join(", ")}`);
