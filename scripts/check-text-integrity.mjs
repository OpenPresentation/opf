import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

async function main() {
  const files = (await Promise.all(scanTargets.map(collectFiles))).flat().sort();
  const failures = [];

  let binaryImages = 0, binaryDocuments = 0, binaryFonts = 0;
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  for (const file of files) {
    const bytes = await readFile(file);
    // Native rendering evidence is binary; interpreting PNG compression bytes
    // as UTF-8 can create false mojibake matches. Keep all text files covered.
    if (bytes.subarray(0, 8).equals(pngSignature)) {
      binaryImages++;
      continue;
    }
    // Only skip known binary evidence with the expected extension AND magic.
    // Text reports, SVG/XML, JSON and logs remain subject to the same checks.
    if (path.extname(file).toLowerCase() === '.pptx' && bytes.subarray(0,4).equals(Buffer.from([80,75,3,4]))) {
      binaryDocuments++;
      continue;
    }
    if (path.extname(file).toLowerCase() === '.ttf' && bytes.subarray(0,4).equals(Buffer.from([0,1,0,0]))) {
      binaryFonts++;
      continue;
    }
    const content = bytes.toString("utf8");
    const lines = content.split(/\r?\n/u);
    for (const [index, line] of lines.entries()) {
      failures.push(...inspectLine(display(file), line, index + 1));
    }
  }

  if (failures.length > 0) {
    process.stderr.write(`text integrity check failed: ${failures.length} rejected signature(s) found\n`);
    for (const failure of failures) {
      process.stderr.write(`${failure.file}:${failure.line}:${failure.column} ${failure.pattern}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(`${JSON.stringify({ valid: true, files: files.length - binaryImages - binaryDocuments - binaryFonts, binaryImages, binaryDocuments, binaryFonts }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exit(1);
});
