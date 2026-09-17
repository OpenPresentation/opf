import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const scanTargets = [
  "spec",
  "docs",
  "examples",
  "README.md",
  "PRODUCT.md",
  "packages/javascript",
];

const rejectedPatterns = [
  { name: "mojibake C3 marker", value: "\u00c3" },
  { name: "mojibake C2 marker", value: "\u00c2" },
  { name: "mojibake punctuation marker", value: "\u00e2\u20ac" },
  { name: "mojibake arrow marker", value: "\u00e2\u2020" },
  { name: "rejected chart slug", value: ["united", "kindom"].join("-") },
];

const ignoredDirectories = new Set([".git", "node_modules", ".pnpm-store"]);

async function collectFiles(target) {
  const fullPath = path.join(repoRoot, target);
  const targetStat = await stat(fullPath);
  if (targetStat.isFile()) {
    return [fullPath];
  }

  const entries = await readdir(fullPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...await collectFiles(path.join(target, entry.name)));
      }
    } else if (entry.isFile()) {
      files.push(path.join(fullPath, entry.name));
    }
  }
  return files;
}

function display(file) {
  return path.relative(repoRoot, file).replaceAll(path.sep, "/");
}

function inspectLine(file, line, lineNumber) {
  const failures = [];
  for (const pattern of rejectedPatterns) {
    let index = line.indexOf(pattern.value);
    while (index !== -1) {
      failures.push({
        file,
        line: lineNumber,
        column: index + 1,
        pattern: pattern.name,
      });
      index = line.indexOf(pattern.value, index + pattern.value.length);
    }
  }
  return failures;
}

export function inspectTextBytes(file, bytes, { maxOutputLength = 64 * 1024 * 1024 } = {}) {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.subarray(0, 8).equals(pngSignature)) return { kind: "binaryImages" };
  if (path.extname(file).toLowerCase() === ".pptx" && bytes.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4]))) return { kind: "binaryDocuments" };
  if (path.extname(file).toLowerCase() === ".ttf" && bytes.subarray(0, 4).equals(Buffer.from([0, 1, 0, 0]))) return { kind: "binaryFonts" };
  // These are compressed text reports, not text encoded in gzip bytes. Keep
  // their actual contents covered, and fail on malformed/oversized archives.
  const compressed = /\.(?:json|log|txt|md|svg|xml)\.gz$/i.test(file);
  if (compressed && !bytes.subarray(0, 3).equals(Buffer.from([31, 139, 8]))) {
    throw new Error(`Expected a gzip text report: ${file}`);
  }
  const content = compressed
    ? new TextDecoder("utf-8", { fatal: true }).decode(gunzipSync(bytes, { maxOutputLength }))
    : bytes.toString("utf8");
  return {
    kind: "text", compressed,
    failures: content.split(/\r?\n/u).flatMap((line, index) => inspectLine(file, line, index + 1)),
  };
}

async function main() {
  const files = (await Promise.all(scanTargets.map(collectFiles))).flat().sort();
  const failures = [];

  const counts = { binaryImages: 0, binaryDocuments: 0, binaryFonts: 0, compressedText: 0 };

  for (const file of files) {
    const bytes = await readFile(file);
    const result = inspectTextBytes(display(file), bytes);
    if (result.kind !== "text") { counts[result.kind]++; continue; }
    if (result.compressed) counts.compressedText++;
    failures.push(...result.failures);
  }

  if (failures.length > 0) {
    process.stderr.write(`text integrity check failed: ${failures.length} rejected signature(s) found\n`);
    for (const failure of failures) {
      process.stderr.write(`${failure.file}:${failure.line}:${failure.column} ${failure.pattern}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(`${JSON.stringify({ valid: true, files: files.length - counts.binaryImages - counts.binaryDocuments - counts.binaryFonts, ...counts }, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exit(1);
  });
}
