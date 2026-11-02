#!/usr/bin/env node
// LH-36 palette discipline: every colour-scheme record of the gallery is checked against the palette
// rules of Claude's Slides and pptx guidance. Tooling only: no record is changed and no engine reads this.
//
// Fails the run (a scheme that breaks one cannot carry readable text):
//   contrast-base     dark1 on light1 (and light1 on dark1) reaches 7:1
//   contrast-surface  dark2 as a background reaches 4.5:1 with light1 text, light2 with dark1 text
//   accent-lightness  accent1 and accent2 (the pair that must be told apart) differ in OKLCH lightness by
//                     at least 0.08, not only in hue
// Reports only (guidance, not a rule: many schemes use these on purpose):
//   accent-close      any accent 1 to 6 pair within 0.05 of each other in lightness
//   pure-neutral      light1 is exactly #FFFFFF or dark1 exactly #000000 (guidance prefers toned neutrals)
//   red-green         accent1 and accent2 are a red and a green of similar lightness (colour-blind risk)
// A scheme that fails today and cannot change in the pull request that adds the check is listed in
// scripts/palette-known-failures.json with the rule and the reason; a stale entry fails too.
//
// Usage:
//   node scripts/check-palette.mjs                       check packages/gallery/catalog/color-schemes
//   node scripts/check-palette.mjs --dir <directory>     check the records of another directory
//   node scripts/check-palette.mjs --summary <file.md>   also write the markdown summary
//   node scripts/check-palette.mjs --quiet               print failures only

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_DIR = path.join(root, "packages/gallery/catalog/color-schemes");
export const KNOWN_FAILURES = path.join(root, "scripts/palette-known-failures.json");

export const THRESHOLDS = { base: 7, surface: 4.5, accentSpread: 0.08, accentClose: 0.05, redGreenLightness: 0.1 };
const FAILING = new Set(["contrast-base", "contrast-surface", "accent-lightness"]);

const SLOTS = ["accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "dark1", "dark2", "light1", "light2"];

export function parseHex(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? ""));
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const linear = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance. */
export function luminance(hex) {
  const [r, g, b] = parseHex(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two colours (1 to 21). */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** OKLCH of a hex colour: lightness 0 to 1, chroma, hue in degrees. */
export function oklch(hex) {
  const [r, g, b] = parseHex(hex).map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(a, bb), h: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360 };
}

const MIN_CHROMA = 0.08; // below this a colour reads as a neutral, not a hue
const hueIn = (h, from, to) => h >= from && h <= to;
export const isRed = (c) => c.C >= MIN_CHROMA && (hueIn(c.h, 0, 40) || c.h >= 350);
export const isGreen = (c) => c.C >= MIN_CHROMA && hueIn(c.h, 115, 165);

/**
 * Findings for one colour-scheme record: [{rule, level: "fail"|"report", message}].
 * A slot that is missing or not a six-digit hex is a fail of its own ("slots").
 */
export function checkScheme(record) {
  const out = [];
  const add = (rule, message) => out.push({ rule, level: FAILING.has(rule) || rule === "slots" ? "fail" : "report", message });
  const bad = SLOTS.filter((slot) => !parseHex(record[slot]));
  if (bad.length) {
    add("slots", `missing or invalid colour slot${bad.length > 1 ? "s" : ""}: ${bad.join(", ")}`);
    return out;
  }
  const ratio = (a, b) => contrast(record[a], record[b]);
  const fmt = (n) => n.toFixed(2);

  const base = ratio("dark1", "light1");
  if (base < THRESHOLDS.base) add("contrast-base", `dark1 ${record.dark1} on light1 ${record.light1} is ${fmt(base)}:1 (needs ${THRESHOLDS.base}:1)`);
  for (const [bg, text] of [["dark2", "light1"], ["light2", "dark1"]]) {
    const r = ratio(bg, text);
    if (r < THRESHOLDS.surface) add("contrast-surface", `${text} ${record[text]} on ${bg} ${record[bg]} is ${fmt(r)}:1 (needs ${THRESHOLDS.surface}:1)`);
  }

  const lightness = Object.fromEntries(SLOTS.slice(0, 6).map((slot) => [slot, oklch(record[slot]).L]));
  const spread = Math.abs(lightness.accent1 - lightness.accent2);
  if (spread < THRESHOLDS.accentSpread) add("accent-lightness", `accent1 ${record.accent1} and accent2 ${record.accent2} differ in OKLCH lightness by only ${fmt(spread)} (needs ${THRESHOLDS.accentSpread})`);
  const close = [];
  for (let i = 1; i <= 6; i++)
    for (let j = i + 1; j <= 6; j++)
      if (record[`accent${i}`].toUpperCase() !== record[`accent${j}`].toUpperCase() && Math.abs(lightness[`accent${i}`] - lightness[`accent${j}`]) < THRESHOLDS.accentClose) close.push(`accent${i}/accent${j}`);
  if (close.length) add("accent-close", `accent pairs within ${THRESHOLDS.accentClose} in lightness: ${close.join(", ")}`);

  const pure = [];
  if (record.light1.toUpperCase() === "#FFFFFF") pure.push("light1 is pure white");
  if (record.dark1.toUpperCase() === "#000000") pure.push("dark1 is pure black");
  if (pure.length) add("pure-neutral", pure.join(", "));

  const a = oklch(record.accent1);
  const b = oklch(record.accent2);
  if (((isRed(a) && isGreen(b)) || (isGreen(a) && isRed(b))) && Math.abs(a.L - b.L) < THRESHOLDS.redGreenLightness)
    add("red-green", `accent1 ${record.accent1} and accent2 ${record.accent2} are a red and a green of similar lightness (${fmt(Math.abs(a.L - b.L))} apart): colour-blind risk`);
  return out;
}

export function loadRecords(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "index.json")
    .sort()
    .map((f) => ({ file: f, record: JSON.parse(readFileSync(path.join(dir, f), "utf8")) }));
}

export function loadKnownFailures(file = KNOWN_FAILURES) {
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, "utf8")).failures ?? [];
}

/** Runs the check over a directory; returns {schemes, failures, reports, stale, ok}. */
export function checkDirectory(dir = DEFAULT_DIR, known = loadKnownFailures()) {
  const schemes = loadRecords(dir).map(({ file, record }) => ({ id: record.id ?? file, findings: checkScheme(record) }));
  const knownKey = new Set(known.map((k) => `${k.id}:${k.rule}`));
  const failures = [];
  const reports = [];
  const seen = new Set();
  for (const { id, findings } of schemes)
    for (const f of findings) {
      const entry = { id, ...f };
      if (f.level === "report") reports.push(entry);
      else if (knownKey.has(`${id}:${f.rule}`)) seen.add(`${id}:${f.rule}`);
      else failures.push(entry);
    }
  const stale = known.filter((k) => !seen.has(`${k.id}:${k.rule}`));
  return { schemes, failures, reports, stale, known, ok: failures.length === 0 && stale.length === 0 };
}

export function markdownSummary(result) {
  const lines = ["## Palette check (LH-36)", "", `${result.schemes.length} colour schemes: ${result.failures.length} failing, ${result.known.length} known failure(s), ${result.reports.length} report-only finding(s).`, ""];
  const table = (title, rows) => {
    if (!rows.length) return;
    lines.push(`### ${title}`, "", "| Scheme | Rule | Finding |", "| --- | --- | --- |");
    for (const r of rows) lines.push(`| ${r.id} | ${r.rule} | ${r.message} |`);
    lines.push("");
  };
  table("Failing", result.failures);
  if (result.known.length) {
    lines.push("### Known failures (recorded, not fixed here)", "", "| Scheme | Rule | Reason |", "| --- | --- | --- |");
    for (const k of result.known) lines.push(`| ${k.id} | ${k.rule} | ${k.reason} |`);
    lines.push("");
  }
  table("Report only", result.reports);
  for (const k of result.stale) lines.push(`Stale known failure: ${k.id} ${k.rule} (no longer fails).`);
  return `${lines.join("\n")}\n`;
}

function main(argv) {
  const arg = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  // the known failures belong to the gallery catalog; another directory is checked without them
  const result = arg("--dir") ? checkDirectory(path.resolve(arg("--dir")), []) : checkDirectory();
  const quiet = argv.includes("--quiet");
  const line = (tag, r) => console.log(`${tag} ${r.id} [${r.rule}] ${r.message}`);
  if (!quiet) for (const r of result.reports) line("report", r);
  for (const r of result.failures) line("FAIL  ", r);
  for (const k of result.stale) console.log(`FAIL   ${k.id} [${k.rule}] listed in palette-known-failures.json but no longer fails; remove the entry`);
  const summary = arg("--summary");
  if (summary) writeFileSync(path.resolve(summary), markdownSummary(result));
  console.log(`palette: ${result.schemes.length} schemes, ${result.failures.length + result.stale.length} failing, ${result.known.length} known, ${result.reports.length} report-only`);
  return result.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));
