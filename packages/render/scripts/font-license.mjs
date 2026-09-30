// FF-31: shared license detection for bundled font packages. Used by scripts/update-font-manifest.mjs
// (to write manifest fields) and test/font-licenses.mjs (to verify them). Matching is deliberately simple:
// each license is recognised by its own standard title or grant text in the file the package ships.

/** Licenses a bundled font may carry (owner decision 2026-09-29). Nothing else is allowed. */
export const ALLOWED_FONT_LICENSES = Object.freeze(['OFL-1.1', 'Apache-2.0', 'MIT', 'UFL-1.0']);

const DETECTORS = [
  ['OFL-1.1', /SIL\s+OPEN\s+FONT\s+LICEN[CS]E,?\s+Version\s+1\.1/i],
  ['Apache-2.0', /Apache\s+License,?\s+Version\s+2\.0/i],
  ['UFL-1.0', /UBUNTU\s+FONT\s+LICEN[CS]E,?\s+Version\s+1\.0/i],
  ['MIT', /Permission\s+is\s+hereby\s+granted,\s+free\s+of\s+charge,\s+to\s+any\s+person\s+obtaining\s+a\s+copy\s+of\s+this\s+software[\s\S]{0,1500}THE\s+SOFTWARE\s+IS\s+PROVIDED\s+"AS\s+IS"/i],
  // Recognised only so that a copyleft or unclear font fails with a clear name.
  ['AGPL', /GNU\s+AFFERO\s+GENERAL\s+PUBLIC\s+LICENSE/i],
  ['LGPL', /GNU\s+(?:LESSER|LIBRARY)\s+GENERAL\s+PUBLIC\s+LICENSE/i],
  ['GPL', /GNU\s+GENERAL\s+PUBLIC\s+LICENSE/i],
];

/** SPDX-style ids found in a license text: one entry per recognised license, in detector order. */
export function detectLicenses(text) {
  return DETECTORS.filter(([, pattern]) => pattern.test(text)).map(([id]) => id);
}

/** The single license a font license file grants, or null when the text is unrecognised or mixes licenses. */
export function detectLicense(text) {
  const found = detectLicenses(text);
  return found.length === 1 ? found[0] : null;
}

// The copyright block precedes the license title. "Reserved Font Name" also appears in the OFL body as a
// definition, so only the block before the license title counts, and the definition sentence is dropped.
function licenseHeader(text) {
  const boundary = text.search(/-{10,}\s*\r?\n\s*SIL\s+OPEN\s+FONT\s+LICEN[CS]E|-{10,}\s*\r?\n\s*Apache|-{10,}\s*\r?\n\s*UBUNTU|\bPREAMBLE\b/i);
  const header = boundary === -1 ? text.slice(0, 4000) : text.slice(0, boundary);
  return header.replace(/["“]?Reserved\s+Font\s+Name["”]?\s+refers\s+to[^]*?(?:\.\s|$)/gi, ' ');
}

const QUOTE_OPEN = '"“\'‘';
const QUOTE_CLOSE = '"”\'’';
const QUOTED = new RegExp(`[${QUOTE_OPEN}]([^${QUOTE_CLOSE}\\n]+)[${QUOTE_CLOSE}]`, 'g');

/** True when the notice mentions a Reserved Font Name in any wording (the OFL's own definition paragraph is ignored). */
export function declaresReservedFontName(text) {
  return /Reserved\s+Font\s+Names?/i.test(licenseHeader(text));
}

/**
 * Reserved Font Names declared in the copyright block (empty when none). RFN only restricts modified versions.
 * Fails closed: a notice that mentions a Reserved Font Name but yields no parsed name (unquoted, or worded in a way
 * this cannot read, for example "(Reserved Font Name Foo)") throws instead of reporting "none".
 */
export function reservedFontNames(text) {
  const header = licenseHeader(text);
  const names = [];
  // "Reserved Font Name(s)" then an optional connector, then a quoted list or an unquoted name up to punctuation.
  const clause = /Reserved\s+Font\s+Names?\s*(?:is|are|:|=)?\s*((?:["“'‘][^"”'’\n]+["”'’](?:\s*(?:,|and|&)\s*)?)+|[^\s"“'‘().,;\n][^().,;\n]*)/gi;
  for (const match of header.matchAll(clause)) {
    const quoted = [...match[1].matchAll(QUOTED)].map(item => item[1].trim());
    names.push(...(quoted.length ? quoted : [match[1].trim()]));
  }
  const result = [...new Set(names.filter(Boolean))].sort();
  if (declaresReservedFontName(text) && result.length === 0) {
    throw new Error('The notice mentions a Reserved Font Name but no name could be read from it; review the license file and extend reservedFontNames().');
  }
  return result;
}

/** First upstream project URL named in the copyright block, or null. */
export function upstreamUrl(text) {
  return /https?:\/\/[^\s)>"']+/.exec(licenseHeader(text))?.[0].replace(/[.,;]+$/, '') ?? null;
}

/** First non-empty line of the license file (the copyright statement). */
export function copyrightLine(text) {
  return text.split(/\r?\n/).map(line => line.trim()).find(Boolean) ?? null;
}

/**
 * Reserved Font Names (owner decision, 2026-09-29). OFL stops a MODIFIED version from using the reserved name in its name.
 * A subset, instance, conversion or edit is a modified version. It is fine when its family and file names do not contain
 * the reserved name (Noto Sans JP reserves "Source"). When they do (Carlito), the face must be the unmodified file its
 * copyright holder released, proved by `upstreamFile: { url, sha256 }` with `sha256` equal to the face's own sha256
 * (byte-identical) and `url` one of the pinned sources below.
 */
export function nameContainsReservedName(names, reserved) {
  const lower = names.map(name => name.toLowerCase());
  return reserved.some(rfn => lower.some(name => name.includes(rfn.toLowerCase())));
}

/** Repositories whose files count as the copyright holder's release. Adding one is a reviewed change. */
export const UNMODIFIED_UPSTREAM_REPOSITORIES = Object.freeze(['google/fonts', 'cyrealtype/Lora-Cyrillic', 'SorkinType/Merriweather-Sans', 'adobe-fonts/source-sans', 'RedHatOfficial/RedHatFont', 'muglug/intos', 'googlefonts/Raleway', 'clauseggers/Playfair']);

/** A pinned raw file (commit sha in the URL), a pinned Git LFS media file, or a release asset of an allowlisted repository. */
export function isUnmodifiedUpstreamUrl(url) {
  const match = /^https:\/\/raw\.githubusercontent\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/[0-9a-f]{40}\/\S+\.(?:ttf|otf)$/.exec(url) ?? /^https:\/\/media\.githubusercontent\.com\/media\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/[0-9a-f]{40}\/\S+\.(?:ttf|otf)$/.exec(url) ?? /^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/releases\/download\/\S+\.(?:ttf|otf)$/.exec(url);
  return Boolean(match) && UNMODIFIED_UPSTREAM_REPOSITORIES.includes(match[1]);
}

/** True when the face proves it is the byte-identical upstream file: a pinned allowlisted URL and the face's own sha256. */
export function provenUnmodified(face) {
  return Boolean(face.upstreamFile) && isUnmodifiedUpstreamUrl(face.upstreamFile.url) && face.upstreamFile.sha256 === face.sha256;
}

/** True when a manifest entry serves a face that is not proven unmodified and whose family or file name contains a Reserved Font Name. */
export function modifiedFaceUsesReservedName(pkg) {
  return pkg.reservedFontNames.length > 0 && pkg.faces.some(face => !provenUnmodified(face) && nameContainsReservedName([face.family, face.file.split(/[\\/]/).pop()], pkg.reservedFontNames));
}

/**
 * Parts of a pinned raw.githubusercontent.com upstream URL, or null. A vendored manifest entry (FF-31) keeps the
 * upstream files in one directory of one repository at one commit: `version` is that commit and `source` is
 * https://github.com/<repository>/tree/<commit>/<directory>.
 */
export function pinnedRawUpstream(url) {
  // Files under Git LFS (Intos) are served as bytes by media.githubusercontent.com/media/<repository>/<commit>/<path>; raw returns a pointer.
  const match = /^https:\/\/(?:raw|media)\.githubusercontent\.com\/(?:media\/)?([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/([0-9a-f]{40})\/(\S+)\/([^/\s]+)$/.exec(url);
  return match ? {repository: match[1], commit: match[2], directory: match[3], file: match[4]} : null;
}

/**
 * Packages with a face that is modified and uses a reserved name in its name, and so must switch to unmodified upstream
 * files, each with why. Empty: Carlito, the only such package, now ships the unmodified google/fonts TTFs from
 * fonts/carlito (FF-31) instead of the Google Fonts API subset in @expo-google-fonts/carlito (for example 2532 glyphs against 2783 in the regular style).
 * This list may only shrink: test/font-licenses.mjs fails on a stale entry and on any package that needs to be listed.
 */
export const RFN_PENDING_UNMODIFIED_UPSTREAM = Object.freeze({});
