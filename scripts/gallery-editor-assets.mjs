import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

// RR-98: the gallery editor page links more than the example's own files (the playground links the editor package's styles.css beside
// playground.css). Derive every local stylesheet and script from the page itself, so a new asset in an editor release cannot be missed.
const sha256 = value => createHash('sha256').update(value).digest('hex');

/** The relative stylesheet and script files an HTML page links, without query strings, in document order and unique. */
export function linkedLocalAssets(html) {
  const found = [];
  const add = value => {
    if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(value)) return;
    const file = value.replace(/[?#].*$/, '');
    if (file && !found.includes(file)) found.push(file);
  };
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    if (/\brel\s*=\s*["']?[^"'>]*\bstylesheet\b/i.test(tag)) add(tag.match(/\bhref\s*=\s*["']([^"']*)["']/i)?.[1]);
  }
  for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) add(tag.match(/\bsrc\s*=\s*["']([^"']*)["']/i)?.[1]);
  return found;
}

/** Append ?v=<revision> to every linked local stylesheet and script (the cache-busting the page already uses for playground.*). */
export function versionLinkedAssets(html, revision) {
  const version = value => (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(value) ? value : `${value.replace(/[?#].*$/, '')}?v=${revision}`);
  return html
    .replace(/<link\b[^>]*>/gi, tag => (/\brel\s*=\s*["']?[^"'>]*\bstylesheet\b/i.test(tag)
      ? tag.replace(/(\bhref\s*=\s*)(["'])([^"']*)\2/i, (_, name, quote, value) => `${name}${quote}${version(value)}${quote}`) : tag))
    .replace(/<script\b[^>]*>/gi, tag => tag.replace(/(\bsrc\s*=\s*)(["'])([^"']*)\2/i, (_, name, quote, value) => `${name}${quote}${version(value)}${quote}`));
}

/**
 * Where each linked asset comes from: a file the build already staged (the example's own files and its bundle), or a file the editor
 * package publishes under the same name in its exports map ("./styles.css" -> dist/styles.css). Anything else is a build error.
 */
export async function packageAssetSources({ linked, staged, editorDirectory }) {
  const pkg = JSON.parse(await readFile(path.join(editorDirectory, 'package.json'), 'utf8'));
  const sources = [];
  for (const file of linked) {
    if (staged.includes(file)) continue;
    const entry = pkg.exports?.[`./${file}`];
    const target = typeof entry === 'string' ? entry : entry?.default;
    if (typeof target !== 'string') throw new Error(`The editor page links ${file}, which neither the example nor ${pkg.name} publishes`);
    const resolved = path.resolve(editorDirectory, target);
    if (path.relative(editorDirectory, resolved).startsWith('..')) throw new Error(`${pkg.name} export ./${file} points outside the package`);
    sources.push({ file, from: resolved });
  }
  return sources;
}

/** Throws unless every local stylesheet and script index.html links is in manifest.json's files, on disk, and matches its digest. */
export async function verifyLinkedAssets(directory) {
  const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  const html = await readFile(path.join(directory, 'index.html'), 'utf8');
  const problems = [];
  for (const file of linkedLocalAssets(html)) {
    if (!manifest.files?.[file]) { problems.push(`${file} is linked by index.html but missing from manifest.json`); continue; }
    try {
      if (sha256(await readFile(path.join(directory, file))) !== manifest.files[file]) problems.push(`${file} differs from its manifest digest`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      problems.push(`${file} is linked by index.html but missing from ${directory}`);
    }
  }
  if (problems.length) throw new Error(`Gallery editor page assets are incomplete:\n${problems.join('\n')}`);
}
