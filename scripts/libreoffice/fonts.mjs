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

// The aliases and the fontconfig file come from opf-render (`fontconfigAliases`, `fontconfigConf`), the same code as
// `opf-preview-fonts --fontconfig`, the one command docs/libreoffice.md gives Linux users: the qualification tests what they install.
async function renderFonts() {
  const requireRender = createRequire(path.join(root, "packages/render/package.json"));
  return import(pathToFileURL(path.join(path.dirname(requireRender.resolve("@openpresentation/opf-render/package.json")), "dist/preview-fonts-node.js")).href);
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
  const { copyPreviewFonts, fontconfigAliases, fontconfigConf } = await renderFonts();
  // Every script face too (Noto Sans JP, Noto Naskh Arabic, ...): OPF previews those scripts with them.
  const copied = copyPreviewFonts({ outDir: fontDir, cwd: root, scripts: "all" });
  const aliases = fontconfigAliases();
  const conf = path.join(directory, "fonts.conf");
  // A whole configuration (the system's included) for FONTCONFIG_FILE, with its own cache.
  writeFileSync(conf, fontconfigConf({ fontDir, aliases, cacheDir, includeSystem: true }));
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
