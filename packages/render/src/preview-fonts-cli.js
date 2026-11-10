#!/usr/bin/env node
// RR-28: `opf-preview-fonts <outDir> [--scripts all|Jpan,Arab] [--fontconfig <file>]` fills a self-hosted font root for <opf-deck>.
// RR-106: --fontconfig also writes a fontconfig file (the font directory and the font-policy aliases), so an app on Linux that resolves
// fonts through fontconfig, LibreOffice among them, draws each family with the face OPF measured it with.
import fs from "node:fs";
import path from "node:path";
import { copyPreviewFonts, fontconfigConf } from "./preview-fonts-node.js";

const args = process.argv.slice(2);
const flag = (name) => { const at = args.indexOf(name); return at === -1 ? undefined : args[at + 1]; };
const outDir = args.find((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--scripts" && args[index - 1] !== "--fontconfig");
if (!outDir || args.includes("--help")) {
  console.error("Usage: opf-preview-fonts <outDir> [--scripts all|Jpan,Arab,...] [--fontconfig <file>]\nCopies the pinned, license-verified preview fonts to <outDir> (serve it as <opf-deck fonts=\"/<outDir>/\">).\n--fontconfig <file> also writes a fontconfig file with <outDir> and an alias per font-policy replacement (Aptos to Intos, ...),\nfor example ~/.config/fontconfig/conf.d/60-opf-fonts.conf, so LibreOffice on Linux draws each family with OPF's face.");
  process.exit(outDir ? 0 : 2);
}
const scripts = flag("--scripts");
const result = copyPreviewFonts({ outDir, scripts: scripts === undefined ? false : scripts === "all" ? "all" : scripts.split(",").map((code) => code.trim()).filter(Boolean) });
console.log(`Preview fonts: ${result.packages} packages, ${result.copied} copied, ${result.verified} already verified, ${(result.bytes / 1048576).toFixed(1)} MiB, all SHA-256 verified.`);
if (result.missing.length) console.warn(`Not installed (script faces skipped): ${result.missing.join(", ")}`);
const fontconfig = flag("--fontconfig");
if (fontconfig) {
  fs.mkdirSync(path.dirname(path.resolve(fontconfig)), { recursive: true });
  fs.writeFileSync(fontconfig, fontconfigConf({ fontDir: path.resolve(outDir) }));
  console.log(`fontconfig: wrote ${fontconfig} (the font directory and the font-policy aliases); run fc-cache -f, then restart the app.`);
}
