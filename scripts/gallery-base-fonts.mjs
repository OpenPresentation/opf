// FF-41: the gallery editor starts with a small set of fonts.
//
// `registry.embeddedFonts` (the renderer's eager faces: Roboto in seven styles, Roboto Mono, the Office substitutes) used to go
// into one fonts.json (12.8 MB) that every /opf-editor visit downloaded. An editor example that understands `base-fonts.json`
// (opf-editor examples/playground.js, FF-41) starts with the faces in fonts.json and loads the rest on demand, face by face,
// hash-verified, through its font gate. This module splits the eager list that way: fonts.json keeps Roboto Regular (the
// renderer's fallback family), every other face becomes a separate file named after its hash, listed with its SHA-256 in
// base-fonts.json. The files are the renderer's own bytes, so like fonts.json before them they are committed to the gallery.
// An older pinned example, which reads fonts.json only, keeps the whole list there.
import { createHash } from 'node:crypto';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const isStartupFace = face => face.family === 'Roboto' && face.weight === 400 && !face.italic;

/** True when the pinned editor example loads `base-fonts.json` (an older example reads fonts.json only). */
export function exampleUsesBaseFonts(exampleSource) {
  return /base-fonts\.json/.test(exampleSource);
}

/**
 * @param {{family: string, weight: number, italic?: boolean, license?: string, dataUrl: string}[]} embeddedFonts
 * @returns {{startup: object[], base: {family: string, weight: number, italic: boolean, license?: string, file: string, sha256: string}[], files: {file: string, bytes: Buffer}[]}}
 */
export function splitBaseFonts(embeddedFonts) {
  const startup = embeddedFonts.filter(isStartupFace);
  if (startup.length !== 1) throw new Error('The renderer must list exactly one Roboto Regular face to start the gallery editor with.');
  const base = [], files = [];
  for (const face of embeddedFonts.filter(face => !isStartupFace(face))) {
    const match = /^data:font\/[a-z0-9]+;base64,([A-Za-z0-9+/=]+)$/.exec(face.dataUrl ?? '');
    if (!match) throw new Error(`${face.family} ${face.weight} has no font data URL.`);
    const bytes = Buffer.from(match[1], 'base64'), hash = sha256(bytes);
    const file = `${face.family.replace(/[^a-z0-9]+/gi, '-')}-${face.weight}-${face.italic ? 'italic' : 'normal'}-${hash.slice(0, 12)}.ttf`;
    if (files.some(item => item.file === file)) throw new Error(`Duplicate base font file ${file}.`);
    base.push({ family: face.family, weight: face.weight, italic: Boolean(face.italic), ...(face.license ? { license: face.license } : {}), file, sha256: hash });
    files.push({ file, bytes });
  }
  return { startup, base, files };
}

/** Throws unless every entry is a flat hash-named .ttf with a SHA-256 that matches `bytesOf(file)`. */
export function verifyBaseFonts(base, bytesOf) {
  const seen = new Set();
  for (const face of base) {
    if (!/^[A-Za-z0-9.-]+-[0-9a-f]{12}\.ttf$/.test(face.file) || seen.has(face.file)) throw new Error(`${face.file} is not a unique flat font file name.`);
    seen.add(face.file);
    if (!/^[0-9a-f]{64}$/.test(face.sha256) || !face.file.includes(`-${face.sha256.slice(0, 12)}.`)) throw new Error(`${face.file} needs a SHA-256 that names it.`);
    if (sha256(bytesOf(face.file)) !== face.sha256) throw new Error(`${face.file} differs from its SHA-256.`);
  }
  return base;
}
