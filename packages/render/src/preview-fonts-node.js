// RR-28: fill a self-hosted font root (the layout of `preview-fonts.js`) from the installed packages, for hosts that serve
// `<opf-deck fonts="/opf-fonts/">`. Node only. Every file is copied unmodified and checked against its pinned SHA-256 and
// every license notice travels with it (LICENSES.txt). Nothing is downloaded: the faces come from this package's `fonts`
// directory and the installed `@expo-google-fonts/*` packages.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { BUNDLED_FONT_MANIFEST } from "./font-manifest.js";
import { previewFontLayout } from "./preview-fonts.js";
import { scriptFontPackages } from "./script-font-pack.js";

const ALLOWED_LICENSES = ["OFL-1.1", "Apache-2.0", "MIT", "UFL-1.0"];
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const safeFile = /^[A-Za-z0-9_./-]+$/;
const rendererRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function within(directory, file) {
  const resolved = path.resolve(directory, file);
  if (file.includes("..") || !safeFile.test(file) || !resolved.startsWith(path.resolve(directory) + path.sep)) throw new Error(`${file} escapes its package directory.`);
  return resolved;
}

function resolvePackageDirectory(name, from) {
  const searched = [createRequire(path.join(rendererRoot, "package.json")), createRequire(path.join(from ?? process.cwd(), "package.json"))];
  for (const requireFrom of searched) {
    try { return path.dirname(requireFrom.resolve(`${name}/package.json`)); } catch { /* try the next location */ }
  }
  return undefined;
}

/**
 * Copy the preview fonts into `outDir`.
 *
 * - `scripts`: which Noto script faces to include (they are large): `false` (default), `"all"`, or ISO 15924 codes such as
 *   `["Jpan", "Arab"]`. A deck that draws a script nobody copied still renders; its text falls back to a system font.
 * - `cwd`: where the optional script packages are looked up when they are not installed beside this package.
 *
 * Returns `{ copied, verified, bytes, files, packages, missing }`; `missing` names script packages that are not installed.
 */
export function copyPreviewFonts({ outDir, scripts = false, cwd, manifest = BUNDLED_FONT_MANIFEST } = {}) {
  if (typeof outDir !== "string" || !outDir) throw new TypeError("copyPreviewFonts needs outDir.");
  const wantedScripts = scripts === false ? new Set() : new Set(scriptFontPackages(scripts === true ? "all" : scripts).map((pkg) => pkg.name));
  let copied = 0, verified = 0, bytes = 0;
  const notices = [], missing = [], files = [];
  const layout = previewFontLayout(manifest).filter((entry) => entry.kind !== "scripts" || wantedScripts.has(entry.pkg.name));
  for (const { pkg, target } of layout) {
    if (!ALLOWED_LICENSES.includes(pkg.license)) throw new Error(`${pkg.name} license ${pkg.license} is not allowed.`);
    const sourceDirectory = pkg.vendored ? within(rendererRoot, pkg.vendored) : resolvePackageDirectory(pkg.name, cwd);
    if (!sourceDirectory || !fs.existsSync(sourceDirectory)) {
      if (pkg.pack === "scripts") { missing.push(pkg.name); continue; }
      throw new Error(`${pkg.name} is not installed: reinstall @openpresentation/opf-render.`);
    }
    if (!pkg.vendored) {
      const installed = JSON.parse(fs.readFileSync(path.join(sourceDirectory, "package.json"), "utf8"));
      if (installed.version !== pkg.version) throw new Error(`Expected ${pkg.name}@${pkg.version}, found ${installed.version}: install the pinned version.`);
    }
    const destinationDirectory = path.join(outDir, target);
    let licenseText = "";
    for (const item of [{ file: pkg.licenseFile, sha256: pkg.licenseSha256 }, ...(pkg.noticeFile ? [{ file: pkg.noticeFile, sha256: pkg.noticeSha256 }] : [])]) {
      const data = fs.readFileSync(within(sourceDirectory, item.file));
      if (sha256(data) !== item.sha256) throw new Error(`${pkg.name} ${item.file} differs from the manifest hash.`);
      fs.mkdirSync(destinationDirectory, { recursive: true });
      fs.writeFileSync(within(destinationDirectory, item.file), data);
      licenseText += `${licenseText ? "\n\n" : ""}${data.toString("utf8").replace(/\r\n/g, "\n").trim()}`;
    }
    notices.push(`${pkg.name}@${pkg.version} (${pkg.license}), ${pkg.source}\n\n${licenseText}`);
    for (const face of pkg.faces) {
      const destination = within(destinationDirectory, face.file);
      files.push(path.posix.join(target, face.file));
      if (fs.existsSync(destination)) {
        const existing = fs.readFileSync(destination);
        if (sha256(existing) === face.sha256) { verified++; bytes += existing.length; continue; }
      }
      const data = fs.readFileSync(within(sourceDirectory, face.file));
      if (sha256(data) !== face.sha256) throw new Error(`${pkg.name}/${face.file} differs from the manifest hash: reinstall the pinned package.`);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, data);
      copied++; bytes += data.length;
    }
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "LICENSES.txt"), `Preview fonts served with <opf-deck>.\nEvery face is a pinned, unmodified copy, verified against its SHA-256.\n\n${notices.join("\n\n---\n\n")}\n`);
  return { copied, verified, bytes, files, packages: layout.length - missing.length, missing };
}
