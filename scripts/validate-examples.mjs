import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validate } from "../packages/javascript/dist/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const examplesRoot = path.join(repoRoot, "examples");

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".opf.json")) {
      files.push(fullPath);
    }
  }
  return files;
}

function display(file) {
  return path.relative(repoRoot, file).replaceAll(path.sep, "/");
}

async function main() {
  const files = (await walk(examplesRoot)).sort((a, b) => a.localeCompare(b));
  const failures = [];

  for (const file of files) {
    const data = JSON.parse(await readFile(file, "utf8"));
    const result = validate(data, { only: ["format"] });
    if (!result.valid) {
      failures.push({ file, errors: result.findings.filter((finding) => finding.severity === "error") });
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(display(failure.file));
      console.error(JSON.stringify(failure.errors, null, 2));
    }
    console.error(`invalid examples: ${failures.length} of ${files.length}`);
    process.exit(1);
  }

  console.log(JSON.stringify({ valid: true, files: files.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
