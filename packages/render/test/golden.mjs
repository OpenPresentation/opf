import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderSvgDeck, svgToPng } from "../dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "test/golden/opf-examples-png.sha256.json");
const expectedCorpusRef = "29713f534a917e327e5e8fdf9a5ba72b4ae6bdf0";
const scale = Number(process.env.OPF_GOLDEN_SCALE ?? "0.25");
const update = process.argv.includes("--update");
const examplesDir = findExamplesDir();

if (!examplesDir) {
  console.log("opf-render golden skipped: no OPF examples corpus found.");
  process.exit(0);
}

const corpusRef = gitHeadFor(examplesDir);
if (!process.env.OPF_EXAMPLES_DIR && corpusRef && corpusRef !== expectedCorpusRef) {
  console.log(`opf-render golden skipped: sibling OPF corpus is ${corpusRef.slice(0, 7)}, expected ${expectedCorpusRef.slice(0, 7)}.`);
  process.exit(0);
}

const files = listOpfExamples(examplesDir);
assert.ok(files.length > 0, `${examplesDir} must contain .opf.json examples`);

const next = {
  version: 1,
  source: {
    repository: "OpenPresentation/opf",
    ref: expectedCorpusRef,
    path: "examples"
  },
  format: "png-sha256",
  scale,
  entries: {}
};

let slideCount = 0;
for (const file of files) {
  const relative = normalizePath(path.relative(examplesDir, file));
  const deck = JSON.parse(readFileSync(file, "utf8"));
  const svgs = renderSvgDeck(deck, { trace: true });
  assert.equal(svgs.length, deck.slides.length, `${relative} must emit one SVG per slide`);

  for (let index = 0; index < svgs.length; index += 1) {
    const png = await svgToPng(svgs[index], { scale });
    next.entries[`${relative}#${index}`] = {
      sha256: sha256(png),
      bytes: png.byteLength
    };
    slideCount += 1;
  }
}

if (update) {
  mkdirSync(path.dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`opf-render golden updated (${files.length} deck(s), ${slideCount} slide(s)).`);
} else {
  assert.ok(existsSync(manifestPath), `${manifestPath} is missing. Run npm run golden:update to approve current output.`);
  const approved = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.deepEqual(next, approved, "OPF example PNG output drifted from the approved golden manifest.");
  console.log(`opf-render golden passed (${files.length} deck(s), ${slideCount} slide(s)).`);
}

function findExamplesDir() {
  const candidates = [
    process.env.OPF_EXAMPLES_DIR,
    path.resolve(root, "../opf/examples"),
    path.resolve(root, "opf-corpus/examples")
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function gitHeadFor(dir) {
  const repo = findGitRoot(dir);
  if (!repo) return null;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repo,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return null;
  }
}

function findGitRoot(dir) {
  let current = path.resolve(dir);
  while (current !== path.dirname(current)) {
    if (existsSync(path.join(current, ".git"))) return current;
    current = path.dirname(current);
  }
  return null;
}

function listOpfExamples(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listOpfExamples(absolute));
    if (entry.isFile() && entry.name.endsWith(".opf.json")) files.push(absolute);
  }
  return files.sort();
}

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
