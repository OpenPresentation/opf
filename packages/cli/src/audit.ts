import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { auditRules, auditSource, findAuditRule, type AuditDiagnostic, type AuditOptions, type AuditReport, type AuditSeverity } from "@openpresentation/opf/audit";

declare const OPF_VERSION: string;

const usage = `opf audit <file|-> [--json] [--rule <id>]... [--ignore <id>]... [--fail-on <error|warning|info|never>]
          [--severity <id>=<error|warning|info|off>]... [--threshold <name>=<number>]... [--config <local-json-file>]
opf audit --list-rules [--json]
opf audit --explain <id> [--json]

Design and accessibility audit: contrast, overflow, minimum type size, alt text, reading order,
fonts, links, charts, placeholders and more. Rule ids are stable (audit/text-contrast); a bare name
(text-contrast) is accepted. --rule runs only the named rules; --ignore skips rules. Repeat a flag or
comma-separate. --fail-on picks the exit threshold (default error). Exit codes: 0 no finding at or above
the threshold, 1 findings at or above it (or a document that fails validation), 2 usage or I/O error.
--json prints the report in lint's shape. A config file may hold {rules, ignore, only, ignorePaths,
thresholds}; flags override it. Audit is read-only and local; it never fetches images or fonts.`;

class AuditUsageError extends Error {}
const rank: Record<AuditSeverity, number> = { error: 3, warning: 2, info: 1 };
const failLevels = ["error", "warning", "info", "never"] as const;
const valueFlags = new Set(["rule", "ignore", "fail-on", "severity", "threshold", "config", "explain"]);
const booleanFlags = new Set(["json", "list-rules"]);

interface Parsed { file?: string; flags: Map<string, string[]> }

function parse(args: string[]): Parsed {
  const flags = new Map<string, string[]>();
  const positional: string[] = [];
  let literal = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--" && !literal) { literal = true; continue; }
    if (!literal && arg.startsWith("--")) {
      const key = arg.slice(2);
      if (booleanFlags.has(key)) {
        if (flags.has(key)) throw new AuditUsageError(`Duplicate option: ${arg}`);
        flags.set(key, []);
      } else if (valueFlags.has(key)) {
        const value = args[++i];
        if (value === undefined || value.startsWith("--")) throw new AuditUsageError(`${arg} needs a value.`);
        flags.set(key, [...(flags.get(key) ?? []), value]);
      } else throw new AuditUsageError(`Unknown option: ${arg}. Run opf audit --help.`);
    } else positional.push(arg);
  }
  if (positional.length > 1) throw new AuditUsageError("Incorrect arguments. Run opf audit --help.");
  return { file: positional[0], flags };
}

const list = (flags: Map<string, string[]>, key: string) => (flags.get(key) ?? []).flatMap(value => value.split(",")).map(value => value.trim()).filter(Boolean);
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

async function stdin() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

function rulesInfo() { return auditRules.map(({ id, severity, category, summary }) => ({ id, severity, category, summary })); }

function ruleOrThrow(name: string) {
  const info = findAuditRule(name);
  if (!info) throw new AuditUsageError(`Unknown audit rule ${JSON.stringify(name)}. Run opf audit --list-rules.`);
  return info;
}

/** The human reporter: one line per finding, `file:line:column  severity  rule  message`, a hint under it, a summary at the end. */
export function formatText(report: AuditReport, file: string): string {
  const lines: string[] = [];
  for (const d of report.diagnostics) {
    const where = d.location ? `${file}:${d.location.line}:${d.location.column}` : `${file}:${d.path || "/"}`;
    lines.push(`${where}  ${d.severity.padEnd(7)} ${d.ruleId}  ${d.message}`);
    lines.push(`    ${d.path || "(document)"}${d.slide !== undefined ? `  (slide ${d.slide + 1})` : ""}`);
    lines.push(`    hint: ${d.help}`);
    for (const fix of d.fixes ?? []) lines.push(`    fix: ${fix.label}${fix.safe ? "" : " (changes meaning; review)"}`);
  }
  const { error, warning, info } = report.counts;
  if (!report.documentValid) lines.push("", "The document does not pass validation, so no design rule was run.");
  lines.push("", `${file}: ${report.diagnostics.length} finding${report.diagnostics.length === 1 ? "" : "s"} (${error} error${error === 1 ? "" : "s"}, ${warning} warning${warning === 1 ? "" : "s"}, ${info} info) in ${report.slideCount} slide${report.slideCount === 1 ? "" : "s"}; ${report.rulesRun.length} rule${report.rulesRun.length === 1 ? "" : "s"} run.`);
  return lines.join("\n") + "\n";
}

function loadConfig(raw: string, file: string): AuditOptions {
  let value: unknown;
  try { value = JSON.parse(raw.replace(/^﻿/, "")); } catch { throw new AuditUsageError(`Invalid JSON in ${file}.`); }
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new AuditUsageError("Audit configuration must be a JSON object.");
  const allowed = ["rules", "ignore", "only", "ignorePaths", "thresholds", "chartPalette"];
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new AuditUsageError(`Unknown audit configuration key ${JSON.stringify(key)}. Keys: ${allowed.join(", ")}.`);
  return value as AuditOptions;
}

export async function runAudit(args: string[]): Promise<void> {
  if (args.length === 1 && ["--help", "-h", "help"].includes(args[0]!)) { console.log(usage); return; }
  const { file, flags } = parse(args);
  const json = flags.has("json");
  if (flags.has("list-rules")) {
    if (file !== undefined) throw new AuditUsageError("--list-rules takes no file.");
    process.stdout.write(json ? JSON.stringify(rulesInfo(), null, 2) + "\n" : rulesInfo().map(rule => `${rule.id.padEnd(30)} ${rule.severity.padEnd(8)} ${rule.category.padEnd(14)} ${rule.summary}`).join("\n") + "\n");
    return;
  }
  if (flags.has("explain")) {
    if (file !== undefined) throw new AuditUsageError("--explain takes no file.");
    const info = ruleOrThrow(list(flags, "explain")[0] ?? "");
    process.stdout.write(json ? JSON.stringify(info, null, 2) + "\n" : [`${info.id} (${info.severity}, ${info.category})`, info.summary, "", `Why: ${info.rationale}`, ...(info.standard ? [`Standard: ${info.standard}`] : []), ...(info.approximations ? [`Approximations: ${info.approximations}`] : []), ...(info.thresholds ? [`Thresholds: ${info.thresholds.join(", ")}`] : [])].join("\n") + "\n");
    return;
  }
  if (file === undefined) throw new AuditUsageError("Audit requires a file or stdin (-). Run opf audit --help.");
  const failOn = (flags.get("fail-on")?.[0] ?? "error") as (typeof failLevels)[number];
  if (!failLevels.includes(failOn)) throw new AuditUsageError("--fail-on must be error, warning, info or never.");
  const configFile = flags.get("config")?.[0];
  if (configFile === "-") throw new AuditUsageError("Audit configuration must be an explicit local JSON file.");
  const configRaw = configFile ? await readFile(configFile, "utf8").catch(() => { throw new AuditUsageError(`Cannot read ${configFile}.`); }) : undefined;
  const options: AuditOptions = configRaw ? loadConfig(configRaw, configFile!) : {};
  const only = list(flags, "rule"), ignore = list(flags, "ignore");
  for (const name of [...only, ...ignore]) ruleOrThrow(name);
  if (only.length) options.only = only;
  if (ignore.length) options.ignore = [...(options.ignore ?? []), ...ignore];
  for (const entry of flags.get("severity") ?? []) {
    const [name, level, ...rest] = entry.split("=");
    if (!name || !level || rest.length || !["error", "warning", "info", "off"].includes(level)) throw new AuditUsageError("--severity needs <rule>=<error|warning|info|off>.");
    options.rules = { ...options.rules, [ruleOrThrow(name).id]: level as AuditSeverity | "off" };
  }
  for (const entry of flags.get("threshold") ?? []) {
    const [name, number, ...rest] = entry.split("=");
    if (!name || number === undefined || rest.length || !Number.isFinite(Number(number))) throw new AuditUsageError("--threshold needs <name>=<number>.");
    options.thresholds = { ...options.thresholds, [name]: Number(number) };
  }
  const raw = file === "-" ? await stdin() : await readFile(file, "utf8").catch(() => { throw new AuditUsageError(`Cannot read ${file}.`); });
  let report: AuditReport;
  try { report = auditSource(raw, options); }
  catch (error) { if (error instanceof TypeError) throw new AuditUsageError(error.message); throw error; }
  const label = file === "-" ? "stdin" : path.relative(process.cwd(), path.resolve(file)) || file;
  if (json) process.stdout.write(JSON.stringify({ ...report, file: file === "-" ? null : path.resolve(file), sha256: hash(raw), opfVersion: OPF_VERSION, ...(configFile ? { context: { file: path.resolve(configFile), sha256: hash(configRaw!) } } : {}) }, null, 2) + "\n");
  else process.stdout.write(formatText(report, label));
  const threshold = failOn === "never" ? Infinity : rank[failOn];
  if (report.diagnostics.some((d: AuditDiagnostic) => rank[d.severity] >= threshold)) process.exitCode = 1;
}
