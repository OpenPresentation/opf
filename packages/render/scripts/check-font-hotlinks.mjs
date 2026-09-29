#!/usr/bin/env node
// FF-31 font rule: bundle pinned font files, never hotlink a font CDN.
//
// Fails when a tracked text file (or, with --built, a build output directory) references a font
// CDN: Google Fonts, Adobe/Typekit, Bunny Fonts, other hosted font services, font CSS on a public
// package CDN, an @import of remote font CSS, or a remote font file inside CSS url(...).
// Tracked files are read from `git ls-files`. Files that legitimately mention a host in prose are
// listed, with a reason, in scripts/font-hotlink-allowlist.json. Allowlist entries are exact
// repo-relative paths, never globs, and a stale entry (file gone or no longer matching) fails too.
// Built output is never allowlisted.
//
// Usage:
//   node scripts/check-font-hotlinks.mjs                  scan tracked files
//   node scripts/check-font-hotlinks.mjs --built <dir>... scan build output directories as well
//
// Host names are assembled from parts so this file does not match its own rules.

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dot = (...parts) => parts.join(".");
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const FONT_CDN_HOSTS = [
  dot("fonts", "googleapis", "com"),
  dot("fonts", "gstatic", "com"),
  dot("use", "typekit", "net"),
  dot("p", "typekit", "net"),
  dot("fonts", "bunny", "net"),
  dot("fast", "fonts", "net"),
  dot("cloud", "typography", "com"),
  dot("use", "fontawesome", "com"),
  dot("kit", "fontawesome", "com"),
  dot("fonts", "adobe", "com"),
  dot("api", "fontshare", "com"),
  dot("cdn", "fontshare", "com"),
  dot("ajax", "googleapis", "com") + "/ajax/libs/webfont",
];

const URL_CHARS = String.raw`[^\s"'\x60)<>]*`;
export const RULES = [
  { id: "font-cdn-host", re: new RegExp(FONT_CDN_HOSTS.map(escapeRe).join("|"), "i") },
  {
    id: "cdnjs-font-css",
    re: new RegExp(`${escapeRe(dot("cdnjs", "cloudflare", "com"))}/${URL_CHARS}font${URL_CHARS}\\.css`, "i"),
  },
  {
    // jsDelivr (npm/ and gh/), unpkg and cdnjs: font CSS, or any font file whatever its path.
    id: "package-cdn-font-file",
    re: new RegExp(
      `(?:${escapeRe(dot("cdn", "jsdelivr", "net"))}|${escapeRe(dot("unpkg", "com"))}|${escapeRe(dot("cdnjs", "cloudflare", "com"))})/(?:${URL_CHARS}font${URL_CHARS}\\.css|${URL_CHARS}\\.(?:woff2?|ttf|otf|eot))`,
      "i",
    ),
  },
  {
    // A runtime fetch(), import(), XHR or FontFace load of a remote font file.
    id: "remote-font-fetch",
    re: new RegExp(
      String.raw`(?:fetch|import|importScripts|axios\.get|loadFont|FontFace)\s*\(\s*(?:new\s+URL\(\s*)?["'\x60](?:https?:)?//[^"'\x60\s]+\.(?:woff2?|ttf|otf|eot)\b|\.open\s*\(\s*["']GET["']\s*,\s*["'\x60](?:https?:)?//[^"'\x60\s]+\.(?:woff2?|ttf|otf|eot)\b`,
      "i",
    ),
  },
  { id: "remote-font-import", re: /@import\s+(?:url\(\s*)?["']?(?:https?:)?\/\/[^"')\s;]*font/i },
  { id: "remote-font-file-in-css", re: /url\(\s*["']?(?:https?:)?\/\/[^)"']+\.(?:woff2?|ttf|otf|eot)\b/i },
];

// Rules that span lines: matched against the whole file and reported at the line where the match starts.
export const TEXT_RULES = [
  // webfontloader pointed at a font service: WebFont.load({ <service>: ... })
  { id: "webfont-loader", re: /WebFont\.load\s*\(\s*\{[^)]{0,400}?\b(?:google|typekit|fontdeck|monotype)\s*:/i },
];

const BINARY_EXTENSIONS = new Set(
  ".png .jpg .jpeg .gif .webp .avif .ico .bmp .tif .tiff .woff .woff2 .ttf .otf .eot .ttc .pdf .zip .gz .tgz .7z .pptx .docx .xlsx .potx .mp4 .mov .webm .mp3 .wav .wasm .node .exe .dll .bin .br .map"
    .split(" "),
);
const LOCKFILES = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "npm-shrinkwrap.json"]);
const MAX_BYTES = 32 * 1024 * 1024;

export function scanText(text) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    for (const rule of RULES) {
      const match = rule.re.exec(lines[i]);
      if (match) findings.push({ line: i + 1, rule: rule.id, match: match[0].slice(0, 120) });
    }
  }
  for (const rule of TEXT_RULES) {
    const match = rule.re.exec(text);
    if (match) {
      findings.push({ line: text.slice(0, match.index).split(/\r?\n/).length, rule: rule.id, match: match[0].replace(/\s+/g, " ").slice(0, 120) });
    }
  }
  return findings;
}

function looksBinary(buffer) {
  const end = Math.min(buffer.length, 8192);
  for (let i = 0; i < end; i += 1) if (buffer[i] === 0) return true;
  return false;
}

export function scanFile(file) {
  const base = path.basename(file);
  if (BINARY_EXTENSIONS.has(path.extname(file).toLowerCase()) || LOCKFILES.has(base)) return [];
  let stats;
  try {
    // lstat: tracked symlinks to directories (Linux checkouts) are skipped; only regular files are scanned.
    stats = lstatSync(file);
  } catch {
    return [];
  }
  if (!stats.isFile() || stats.size > MAX_BYTES) return [];
  const buffer = readFileSync(file);
  if (looksBinary(buffer)) return [];
  return scanText(buffer.toString("utf8"));
}

export function trackedFiles(root) {
  const out = execFileSync("git", ["-c", "core.quotepath=off", "-c", `safe.directory=${root}`, "ls-files", "-z"], { cwd: root, maxBuffer: 256 * 1024 * 1024 });
  return out.toString("utf8").split("\0").filter(Boolean);
}

export function walk(dir) {
  const files = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) files.push(full);
    }
  }
  return files;
}

export function loadAllowlist(file) {
  if (!existsSync(file)) return [];
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  const entries = Array.isArray(parsed.allow) ? parsed.allow : [];
  for (const entry of entries) {
    if (typeof entry.path !== "string" || /[*?]/.test(entry.path)) throw new Error(`allowlist path must be an exact repo-relative path: ${JSON.stringify(entry)}`);
    if (typeof entry.reason !== "string" || entry.reason.trim().length < 10) throw new Error(`allowlist entry needs a reason: ${entry.path}`);
  }
  return entries;
}

export function checkRepo({ root, allowlistFile, builtDirs = [], files = trackedFiles(root) }) {
  const allow = new Map(loadAllowlist(allowlistFile).map((entry) => [entry.path, entry]));
  const problems = [];
  const used = new Set();
  for (const rel of files) {
    const findings = scanFile(path.join(root, rel));
    if (!findings.length) continue;
    const posix = rel.split(path.sep).join("/");
    if (allow.has(posix)) {
      used.add(posix);
      continue;
    }
    for (const finding of findings) problems.push({ file: posix, ...finding });
  }
  for (const key of allow.keys()) {
    if (!used.has(key)) problems.push({ file: key, line: 0, rule: "stale-allowlist-entry", match: "allowlisted file is missing or no longer references a font CDN; remove the entry" });
  }
  for (const dir of builtDirs) {
    if (!existsSync(dir)) {
      problems.push({ file: dir, line: 0, rule: "built-dir-missing", match: "build output directory does not exist; build first" });
      continue;
    }
    for (const file of walk(dir)) {
      for (const finding of scanFile(file)) problems.push({ file: path.relative(root, file).split(path.sep).join("/"), ...finding });
    }
  }
  return problems;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const args = process.argv.slice(2);
  const builtDirs = [];
  const builtAt = args.indexOf("--built");
  if (builtAt !== -1) builtDirs.push(...args.slice(builtAt + 1).map((dir) => path.resolve(root, dir)));
  const problems = checkRepo({ root, allowlistFile: path.join(root, "scripts", "font-hotlink-allowlist.json"), builtDirs });
  if (problems.length) {
    console.error("Font CDN references found. Bundle pinned font files instead of hotlinking (FF-31).");
    for (const p of problems.slice(0, 200)) console.error(`  ${p.file}:${p.line} [${p.rule}] ${p.match}`);
    if (problems.length > 200) console.error(`  ... and ${problems.length - 200} more`);
    process.exit(1);
  }
  console.log(`font hotlink check passed${builtDirs.length ? ` (tracked files + ${builtDirs.length} build dir(s))` : " (tracked files)"}`);
}
