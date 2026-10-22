#!/usr/bin/env node
// The license check: the repository and the npm package are MIT.
//
//   node scripts/check-license.mjs
//
// It fails when LICENSE is not the MIT License, when package.json does not declare "MIT", or when the published files
// (package.json `files`) leave LICENSE out. The catalog records, the previews and the code are all under that license.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The problems with `license` (the LICENSE text) and `manifest` (package.json); empty when both are MIT. */
export function licenseProblems(license, manifest) {
  const problems = [];
  if (!/^MIT License\s*$/m.test(license.split("\n")[0] ?? "")) problems.push("LICENSE does not start with \"MIT License\"");
  if (!/^Copyright \(c\) \d{4}/m.test(license)) problems.push("LICENSE has no copyright line");
  if (!license.includes("Permission is hereby granted, free of charge, to any person obtaining a copy")) problems.push("LICENSE is not the MIT permission notice");
  if (!license.includes('THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND')) problems.push("LICENSE lacks the MIT warranty disclaimer");
  if (manifest.license !== "MIT") problems.push(`package.json license is ${JSON.stringify(manifest.license)}, not "MIT"`);
  if (!Array.isArray(manifest.files) || !manifest.files.includes("LICENSE")) problems.push("package.json files does not publish LICENSE");
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = licenseProblems(readFileSync(path.join(root, "LICENSE"), "utf8"), JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")));
  if (problems.length) {
    process.stderr.write(`License check failed:\n${problems.map((problem) => `  ${problem}`).join("\n")}\n`);
    process.exit(1);
  }
  process.stdout.write("License check: MIT (LICENSE, package.json, published files).\n");
}
