#!/usr/bin/env node
// The OPF conformance runner (docs/conformance.md): runs the cases of conformance/manifest.json against a tool and writes a
// conformance report.
//
//   node conformance/run.mjs                                            # the reference adapter (@openpresentation/opf)
//   node conformance/run.mjs --adapter ./my-adapter.mjs                 # a library: a module with check() and roundTrip()
//   node conformance/run.mjs --check-command "mytool validate {file}"   # a command: exit 0 accepts, 1 rejects
//   node conformance/run.mjs --check-command "..." --write-command "mytool convert {in} {out}" --name mytool --tool-version 1.2.0
//   node conformance/run.mjs --level reader --format json --report report.json
//
// Exit codes: 0 every level that ran passed, 1 a level failed, 2 usage error.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

const here = path.dirname(fileURLToPath(import.meta.url));
export const manifestPath = path.join(here, "manifest.json");
export const referenceAdapterPath = path.join(here, "adapters", "opf-core.mjs");

/** The manifest with every group expanded into cases; each case gets `path` (absolute) and `source` (relative to the repository). */
export function loadSuite(file = manifestPath) {
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  const base = path.dirname(file);
  const repoRoot = path.dirname(base);
  const cases = [];
  for (const group of manifest.groups ?? []) {
    const directory = path.resolve(base, group.directory);
    for (const name of readdirSync(directory).filter((entry) => entry.endsWith(group.suffix)).sort()) {
      cases.push({ id: `${group.idPrefix}${name.slice(0, -group.suffix.length)}`, file: path.relative(base, path.join(directory, name)), levels: group.levels, expect: group.expect, description: group.description, basis: group.basis });
    }
  }
  cases.push(...manifest.cases);
  const ids = new Set();
  for (const entry of cases) {
    if (ids.has(entry.id)) throw new Error(`conformance: duplicate case id ${entry.id}`);
    ids.add(entry.id);
    entry.path = path.resolve(base, entry.file);
    entry.source = path.relative(repoRoot, entry.path).replaceAll(path.sep, "/");
  }
  return { manifest, cases, repoRoot };
}

/** sha256 of the manifest and every case file, in case order: what a claim was measured against. */
export function suiteDigest(file, cases) {
  const hash = createHash("sha256");
  hash.update(readFileSync(file));
  for (const entry of cases) hash.update(`\0${entry.source}\0`).update(readFileSync(entry.path));
  return hash.digest("hex");
}

function suiteVersions(repoRoot) {
  let opfVersion = null;
  let commit = null;
  try {
    opfVersion = JSON.parse(readFileSync(path.join(repoRoot, "packages/javascript/package.json"), "utf8")).version;
  } catch {}
  const git = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" });
  if (git.status === 0) commit = git.stdout.trim();
  return { opfVersion, commit };
}

/** True when `reported` is the expected pointer or inside it. */
export function pathMatches(expected, reported) {
  return reported === expected || reported.startsWith(`${expected}/`);
}

const quote = (value) => `"${value.replaceAll('"', '\\"')}"`;

function runCommand(template, substitutions, timeout) {
  const command = Object.entries(substitutions).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, quote(value)), template);
  return spawnSync(command, { shell: true, encoding: "utf8", timeout, maxBuffer: 64 * 1024 * 1024 });
}

/** Error paths from a command's JSON output, when it prints any: `findings`, `files[0].findings` or `errors`. */
function errorPathsFromOutput(stdout) {
  let output;
  try {
    output = JSON.parse(stdout);
  } catch {
    return undefined;
  }
  const findings = output?.findings ?? output?.files?.[0]?.findings ?? output?.errors;
  if (!Array.isArray(findings)) return undefined;
  return findings.filter((finding) => typeof finding?.path === "string" && (finding.severity === undefined || finding.severity === "error")).map((finding) => ({ path: finding.path }));
}

/** An adapter that runs commands: `{file}` is the document; `{in}` and `{out}` are the writer's input and output files. */
export function commandAdapter({ check, write, name, version, timeout = 60_000 }) {
  const adapter = { name: name ?? check ?? write, version: version ?? null };
  if (check) {
    adapter.check = (_text, { path: file }) => {
      const result = runCommand(check, { file }, timeout);
      if (result.error || (result.status !== 0 && result.status !== 1)) throw new Error(`exit ${result.status ?? result.signal ?? result.error?.message}: ${(result.stderr || result.stdout || "").trim().slice(0, 300)}`);
      return { valid: result.status === 0, errors: errorPathsFromOutput(result.stdout) };
    };
  }
  if (write) {
    adapter.roundTrip = (text) => {
      const directory = mkdtempSync(path.join(tmpdir(), "opf-conformance-"));
      try {
        const input = path.join(directory, "input.opf.json");
        const output = path.join(directory, "output.opf.json");
        writeFileSync(input, text);
        const result = runCommand(write, { in: input, out: output }, timeout);
        if (result.error || result.status !== 0) throw new Error(`exit ${result.status ?? result.signal ?? result.error?.message}: ${(result.stderr || result.stdout || "").trim().slice(0, 300)}`);
        return readFileSync(output, "utf8");
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    };
  }
  return adapter;
}

export async function loadAdapter(file) {
  const module = await import(pathToFileURL(path.resolve(file)).href);
  return module.default ?? module;
}

/** Every `extensions` object and every `id` of a parsed document, by JSON Pointer. Extension content is not searched for ids. */
export function preservedValues(document) {
  const values = new Map();
  const walk = (value, pointer) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        walk(item, `${pointer}/${index}`);
      });
      return;
    }
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      const childPointer = `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
      if (key === "extensions") values.set(childPointer, child);
      else if (key === "id" && typeof child === "string") values.set(childPointer, child);
      else walk(child, childPointer);
    }
  };
  walk(document, "");
  return values;
}

function valueAt(document, pointer) {
  let value = document;
  for (const token of pointer.split("/").slice(1)) {
    const key = token.replaceAll("~1", "/").replaceAll("~0", "~");
    if (value === null || typeof value !== "object" || !Object.hasOwn(value, key)) return undefined;
    value = value[key];
  }
  return value;
}

async function referenceCheck() {
  const { validate } = await import("@openpresentation/opf").catch((error) => {
    throw new Error(`the Writer level checks output with @openpresentation/opf; run pnpm install and pnpm build first (${error.message})`);
  });
  return (text) => validate(text, { only: ["format", "references"], catalogs: [] });
}

async function readerCase(adapter, entry, text) {
  const result = { id: entry.id, level: "reader", file: entry.source, expected: entry.expect.valid ? "valid" : "invalid" };
  let answer;
  try {
    answer = await adapter.check(text, { path: entry.path, id: entry.id });
  } catch (error) {
    return { ...result, status: "error", message: String(error?.message ?? error) };
  }
  result.actual = answer.valid ? "valid" : "invalid";
  result.status = answer.valid === entry.expect.valid ? "pass" : "fail";
  if (result.status === "fail") result.message = `expected ${result.expected}, the tool said ${result.actual}`;
  if (!entry.expect.valid && entry.expect.errorAt !== undefined) {
    result.errorAt = entry.expect.errorAt;
    const paths = Array.isArray(answer.errors) ? answer.errors.map((error) => error.path).filter((value) => typeof value === "string") : undefined;
    result.location = paths === undefined || paths.length === 0 ? "not-reported" : paths.some((value) => pathMatches(entry.expect.errorAt, value)) ? "matched" : "unmatched";
    if (result.location === "unmatched") result.reported = paths.slice(0, 3);
  }
  return result;
}

async function writerCase(adapter, entry, text, check) {
  const result = { id: entry.id, level: "writer", file: entry.source };
  let output;
  try {
    output = await adapter.roundTrip(text, { path: entry.path, id: entry.id });
  } catch (error) {
    return { ...result, status: "error", message: String(error?.message ?? error) };
  }
  const problems = [];
  let written;
  try {
    written = JSON.parse(output);
  } catch (error) {
    return { ...result, status: "fail", message: `the output is not JSON: ${error.message}` };
  }
  const report = check(output);
  if (!report.valid) {
    const errors = report.findings.filter((finding) => finding.severity === "error");
    problems.push(`the output is not valid OPF (${errors.slice(0, 3).map((finding) => `${finding.ruleId} at ${finding.path || "/"}`).join(", ")})`);
  }
  const original = JSON.parse(text);
  for (const [pointer, value] of preservedValues(original)) {
    if (!isDeepStrictEqual(valueAt(written, pointer), value)) problems.push(`${pointer.endsWith("/id") ? "id" : "extensions"} at ${pointer} changed or is missing`);
  }
  result.status = problems.length === 0 ? "pass" : "fail";
  if (problems.length > 0) result.message = problems.slice(0, 5).join("; ");
  result.lossless = isDeepStrictEqual(written, original);
  return result;
}

/**
 * Runs the suite. `levels` defaults to every available level the adapter supports (Reader needs check(), Writer needs
 * roundTrip()). Returns the conformance report.
 */
export async function runSuite({ adapter, levels, manifest: file = manifestPath, only } = {}) {
  if (!adapter || typeof adapter.check !== "function") throw new TypeError("conformance: the adapter needs a check(text) function");
  const { manifest, cases, repoRoot } = loadSuite(file);
  const available = manifest.levels.filter((level) => level.status === "available").map((level) => level.id);
  const supported = { reader: typeof adapter.check === "function", writer: typeof adapter.roundTrip === "function" };
  const requested = levels ?? available.filter((id) => supported[id]);
  for (const id of requested) {
    if (!manifest.levels.some((level) => level.id === id)) throw new TypeError(`conformance: unknown level ${id}`);
    if (!available.includes(id)) throw new TypeError(`conformance: level ${id} is planned, not available yet`);
    if (!supported[id]) throw new TypeError(`conformance: level ${id} needs ${id === "writer" ? "roundTrip() or --write-command" : "check()"}`);
  }
  const selected = cases.filter((entry) => !only || entry.id.startsWith(only));
  const results = [];
  const check = requested.includes("writer") ? await referenceCheck() : null;
  for (const entry of selected) {
    const text = readFileSync(entry.path, "utf8");
    if (requested.includes("reader") && entry.levels.includes("reader")) results.push(await readerCase(adapter, entry, text));
    if (requested.includes("writer") && entry.levels.includes("writer")) results.push(await writerCase(adapter, entry, text, check));
  }
  const levelReports = manifest.levels.map((level) => {
    const own = results.filter((result) => result.level === level.id);
    const counts = { total: own.length, pass: own.filter((result) => result.status === "pass").length, fail: own.filter((result) => result.status === "fail").length, error: own.filter((result) => result.status === "error").length };
    const status = level.status === "planned" ? "planned" : requested.includes(level.id) ? (counts.pass === counts.total && counts.total > 0 ? "pass" : "fail") : "not-run";
    const report = { id: level.id, name: level.name, status, requires: level.requires, ...counts };
    if (level.id === "reader" && own.length > 0) {
      const located = own.filter((result) => result.location);
      report.location = { cases: located.length, matched: located.filter((result) => result.location === "matched").length, unmatched: located.filter((result) => result.location === "unmatched").length, notReported: located.filter((result) => result.location === "not-reported").length };
    }
    if (level.id === "writer" && own.length > 0) report.lossless = own.filter((result) => result.lossless).length;
    return report;
  });
  // A level is claimed only with the levels it requires.
  for (const level of levelReports) {
    if (level.status === "pass" && level.requires.some((id) => levelReports.find((other) => other.id === id)?.status !== "pass")) level.status = "incomplete";
  }
  const versions = suiteVersions(repoRoot);
  return {
    suite: { name: manifest.suite, format: manifest.format, opfVersion: versions.opfVersion, commit: versions.commit, digest: suiteDigest(file, cases), cases: cases.length, filter: only ?? null },
    tool: { name: adapter.name ?? "unnamed tool", version: adapter.version ?? null },
    date: new Date().toISOString().slice(0, 10),
    levels: levelReports,
    passed: levelReports.filter((level) => level.status === "pass").map((level) => level.name),
    results,
  };
}

export function formatMarkdown(report) {
  const lines = [
    "# OPF conformance report",
    "",
    `- Tool: ${report.tool.name}${report.tool.version ? ` ${report.tool.version}` : ""}`,
    `- Suite: ${report.suite.name} (OPF ${report.suite.opfVersion ?? "unknown"}${report.suite.commit ? `, commit ${report.suite.commit.slice(0, 12)}` : ""}), ${report.suite.cases} cases, sha256 ${report.suite.digest.slice(0, 16)}${report.suite.filter ? `, filtered to ${report.suite.filter}` : ""}`,
    `- Date: ${report.date}`,
    `- Levels passed: ${report.passed.length > 0 ? report.passed.join(", ") : "none"}`,
    "",
    "| Level | Status | Passed | Failed | Errors |",
    "| --- | --- | --- | --- | --- |",
    ...report.levels.map((level) => `| ${level.name} | ${level.status} | ${level.total ? `${level.pass} of ${level.total}` : ""} | ${level.total ? level.fail : ""} | ${level.total ? level.error : ""} |`),
  ];
  const reader = report.levels.find((level) => level.id === "reader");
  const writer = report.levels.find((level) => level.id === "writer");
  const notes = [];
  if (reader?.location?.cases) notes.push(`Error locations (informational): ${reader.location.matched} of ${reader.location.cases} invalid cases reported an error at the expected path, ${reader.location.unmatched} elsewhere, ${reader.location.notReported} without a path.`);
  if (writer?.total) notes.push(`Lossless round trips (informational): ${writer.lossless} of ${writer.total} documents came back unchanged.`);
  if (notes.length > 0) lines.push("", ...notes);
  const failures = report.results.filter((result) => result.status !== "pass");
  if (failures.length > 0) {
    lines.push("", "## Failures", "");
    for (const result of failures) lines.push(`- \`${result.id}\` (${result.level}, ${result.status}): ${result.message ?? ""} [${result.file}]`);
  }
  return `${lines.join("\n")}\n`;
}

const usage = `Usage: node conformance/run.mjs [--adapter <module> | --check-command <cmd>] [--write-command <cmd>]
  [--level reader,writer] [--case <id prefix>] [--name <tool>] [--tool-version <v>] [--format markdown|json] [--report <file>]
Without --adapter or --check-command it runs the reference adapter (${path.relative(process.cwd(), referenceAdapterPath)}).
--check-command: {file} is the document; exit 0 accepts it, 1 rejects it, anything else is a tool error.
--write-command: {in} is the document, {out} the file the tool writes. See docs/conformance.md.`;

function parseArguments(argv) {
  const options = {};
  const names = { "--adapter": "adapter", "--check-command": "check", "--write-command": "write", "--level": "level", "--case": "only", "--name": "name", "--tool-version": "version", "--format": "format", "--report": "report" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") return { help: true };
    const name = names[argument];
    if (!name || argv[index + 1] === undefined) throw new TypeError(`unknown or incomplete option ${argument}`);
    index += 1;
    options[name] = argv[index];
  }
  if (options.adapter && options.check) throw new TypeError("use --adapter or --check-command, not both");
  if (options.format && !["markdown", "json"].includes(options.format)) throw new TypeError("--format is markdown or json");
  return options;
}

async function main() {
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`${error.message}\n\n${usage}`);
    return 2;
  }
  if (options.help) {
    console.log(usage);
    return 0;
  }
  let adapter;
  if (options.check || (options.write && !options.adapter)) {
    if (!options.check) {
      console.error(`--write-command needs --check-command (a Writer is also a Reader)\n\n${usage}`);
      return 2;
    }
    adapter = commandAdapter({ check: options.check, write: options.write, name: options.name, version: options.version });
  } else {
    adapter = await loadAdapter(options.adapter ?? referenceAdapterPath);
    if (options.name || options.version) adapter = { ...adapter, name: options.name ?? adapter.name, version: options.version ?? adapter.version };
  }
  let report;
  try {
    report = await runSuite({ adapter, levels: options.level?.split(","), only: options.only });
  } catch (error) {
    console.error(error.message);
    return 2;
  }
  if (options.report) writeFileSync(options.report, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(options.format === "json" ? `${JSON.stringify(report, null, 2)}\n` : formatMarkdown(report));
  return report.levels.some((level) => level.status === "fail" || level.status === "incomplete") ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = await main();
