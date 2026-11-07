// The font profiles of the LibreOffice qualification (docs/libreoffice.md, "Fonts"):
//   stock  the pinned image's fonts and the fonts LibreOffice bundles, nothing from OPF: what a Linux user without OPF's fonts sees.
//   opf    stock plus every pinned OPF preview font (opf-render's copyPreviewFonts, SHA-256 verified, licenses written beside them)
//          and one fontconfig alias per font-policy family that OPF previews with a replacement (Aptos -> Intos, Calibri -> Carlito):
//          LibreOffice then draws each family with the face OPF measured it with. This is the documented profile the baseline
//          is judged in.
// Both profiles record the exact identities: fontconfig's answer for every family a deck asks for, with the file and its SHA-256.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const PROFILES = Object.freeze(["opf", "stock"]);

/** One alias per font-policy row that has a replacement family: [{family, prefer, compatibility}]. */
export function policyAliases(policy) {
  const aliases = [];
  for (const row of policy.families) {
    const replacement = row.replacement;
    const prefer = replacement?.family ?? replacement?.measured?.replacement;
    if (typeof prefer !== "string" || !prefer || prefer.toLowerCase() === row.family.toLowerCase()) continue;
    aliases.push({ family: row.family, prefer, compatibility: replacement.compatibility ?? (replacement.measured?.maxAbsWidthDelta === 0 ? "metric" : "visual") });
  }
  return aliases;
}

const escapeXml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);

/**
 * A fonts.conf that keeps the system configuration and adds `fontDir` and the aliases. `binding="same"` with a strong match makes the
 * replacement win over fontconfig's generic fallback, as an installed family would.
 */
export function fontsConf({ fontDir, aliases, cacheDir, includeSystem = true }) {
  const lines = ['<?xml version="1.0"?>', '<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">', "<fontconfig>"];
  if (includeSystem) lines.push('  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>');
  if (fontDir) lines.push(`  <dir>${escapeXml(fontDir)}</dir>`);
  if (cacheDir) lines.push(`  <cachedir>${escapeXml(cacheDir)}</cachedir>`);
  for (const alias of aliases) {
    lines.push(`  <match target="pattern"><test name="family" qual="any"><string>${escapeXml(alias.family)}</string></test><edit name="family" mode="assign" binding="same"><string>${escapeXml(alias.prefer)}</string></edit></match>`);
  }
  lines.push("</fontconfig>", "");
  return lines.join("\n");
}

const sha256File = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

/** Prepare a profile under `directory`. Returns {name, env, fontDir, copied, aliases, conf}. */
export async function prepareProfile(name, directory) {
  if (!PROFILES.includes(name)) throw new Error(`unknown font profile ${name}`);
  if (name === "stock") return { name, env: {}, fontDir: null, copied: 0, aliases: [] };
  const fontDir = path.join(directory, "fonts");
  const cacheDir = path.join(directory, "cache");
  mkdirSync(fontDir, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });
  const requireRender = createRequire(path.join(root, "packages/render/package.json"));
  const { copyPreviewFonts } = await import(pathToFileURL(path.join(path.dirname(requireRender.resolve("@openpresentation/opf-render/package.json")), "dist/preview-fonts-node.js")).href);
  // Every script face too (Noto Sans JP, Noto Naskh Arabic, ...): OPF previews those scripts with them.
  const copied = copyPreviewFonts({ outDir: fontDir, cwd: root, scripts: "all" });
  const policy = JSON.parse(readFileSync(path.join(root, "spec/reference/font-policy.json"), "utf8"));
  const aliases = policyAliases(policy);
  const conf = path.join(directory, "fonts.conf");
  writeFileSync(conf, fontsConf({ fontDir, aliases, cacheDir }));
  const env = { FONTCONFIG_FILE: conf };
  spawnSync("fc-cache", ["-f"], { env: { ...process.env, ...env }, encoding: "utf8" });
  return { name, env, fontDir, conf, copied: copied.copied ?? copied.files?.length ?? 0, missing: copied.missing ?? [], aliases };
}

/** fontconfig's answer for `family` in `env`: {family, style, file, sha256}. */
export function fcMatch(family, env = {}) {
  const run = spawnSync("fc-match", ["-f", "%{family[0]}\t%{style[0]}\t%{file}", `${family}:style=Regular`], { env: { ...process.env, ...env }, encoding: "utf8" });
  if (run.status !== 0 || !run.stdout) return { family: null, style: null, file: null, sha256: null, error: (run.stderr || run.error?.message || "fc-match failed").trim() };
  const [matched, style, file] = run.stdout.split("\t");
  return { family: matched, style, file, sha256: file && existsSync(file) ? sha256File(file) : null };
}

/** Every font file fontconfig knows in `env`, as one digest of "family<TAB>style<TAB>sha256" lines, plus the count. */
export function fontInventory(env = {}) {
  const run = spawnSync("fc-list", ["-f", "%{family[0]}\t%{style[0]}\t%{file}\n"], { env: { ...process.env, ...env }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0) return { count: 0, digest: null, error: (run.stderr || run.error?.message || "fc-list failed").trim() };
  const lines = run.stdout.split("\n").filter(Boolean).map((line) => {
    const [family, style, file] = line.split("\t");
    return `${family}\t${style}\t${existsSync(file) ? sha256File(file) : "missing"}`;
  }).sort();
  return { count: lines.length, digest: createHash("sha256").update(lines.join("\n")).digest("hex"), families: [...new Set(lines.map((line) => line.split("\t")[0]))].sort() };
}

/**
 * How each requested family resolves: fontconfig's match, and the face LibreOffice drew (from the PDF's font list). `resolution` is
 * `installed` when fontconfig matched the family itself, `aliased` when it matched OPF's replacement in the opf profile, else `substituted`.
 */
export function resolveRequested(requested, env, aliases, pdfFontNames = []) {
  const normal = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return requested.map((family) => {
    const match = fcMatch(family, env);
    const alias = aliases.find((entry) => normal(entry.family) === normal(family));
    // The face LibreOffice drew for this family, when the PDF's font names show it unambiguously (its own fallback can differ from
    // fontconfig's answer: in the stock image fontconfig answers WenQuanYi Zen Hei for Aptos, LibreOffice draws its bundled Noto Sans).
    const candidates = pdfFontNames.filter((name) => normal(name).startsWith(normal(match.family ?? "~")));
    const drawn = candidates.length === 1 ? candidates[0] : candidates.length ? candidates.join(" / ") : null;
    const resolution = normal(match.family) === normal(family) ? "installed" : alias && normal(match.family) === normal(alias.prefer) ? "aliased" : "substituted";
    return { family, resolution, matched: match.family, style: match.style, file: match.file ? path.basename(match.file) : null, sha256: match.sha256, drawn, ...(alias ? { alias: alias.prefer, aliasCompatibility: alias.compatibility } : {}) };
  });
}

/** `node scripts/libreoffice/fonts.mjs aliases` prints the aliases alone, as a file for ~/.config/fontconfig/conf.d/ (docs/libreoffice.md). */
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv[2] !== "aliases") {
    console.error("Usage: node scripts/libreoffice/fonts.mjs aliases > ~/.config/fontconfig/conf.d/60-opf-font-policy.conf");
    process.exit(2);
  }
  const policy = JSON.parse(readFileSync(path.join(root, "spec/reference/font-policy.json"), "utf8"));
  process.stdout.write(fontsConf({ aliases: policyAliases(policy), includeSystem: false }));
}
