// MR-23c: reads the repository's pnpm-lock.yaml (v9) for the checks that used to read this package's own
// package-lock.json. Plain Node, no YAML dependency: the lockfile is machine-written, so the three sections this
// reads (`importers`, `packages`, `snapshots`) have one fixed line shape.
//
//   lockedIntegrity(text, name, version)  the integrity of one locked registry package
//   lockedPackageSet(text, importerDir)   the registry packages the importer installs (direct and transitive,
//                                         dev dependencies included), as sorted "name@version integrity" lines
//   lockEvidenceSha256(text, importerDir) sha256 of that set: the lockfile evidence the native and comparison
//                                         tests record (the same value for the same installed package set)
//   readRepositoryLock(packageDir)        { text, importerDir } of the nearest pnpm-lock.yaml above packageDir
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const unquote = (value) => value.replace(/^(['"])(.*)\1$/, '$2');
const baseVersion = (version) => version.replace(/\(.*$/, '');

/** The lines of a top-level section (`importers`, `packages`, `snapshots`), without the header. */
function section(text, name) {
  const lines = text.replaceAll('\r\n', '\n').split('\n');
  const start = lines.indexOf(`${name}:`);
  if (start < 0) throw new Error(`pnpm-lock.yaml has no ${name} section`);
  const out = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\S/.test(lines[index])) break;
    out.push(lines[index]);
  }
  return out;
}

/** Entries of a two-space-indented map: `{ key: [body lines] }` (an inline `key: {...}` has an empty body). */
function entries(lines) {
  const map = new Map();
  let current = null;
  for (const line of lines) {
    const head = /^ {2}(\S.*?):(?: (.*))?$/.exec(line);
    if (head && !line.startsWith('   ')) {
      current = [];
      map.set(unquote(head[1]), current);
      if (head[2] && head[2] !== '{}') current.push(`    inline: ${head[2]}`);
    } else if (current && line.trim()) current.push(line);
  }
  return map;
}

/** Name -> version pairs of a `dependencies`-style block at the given indent inside an entry body. */
function pairs(body, block, indent, { versionKey = null } = {}) {
  const result = [];
  const header = `${' '.repeat(indent - 2)}${block}:`;
  let inside = false;
  let pending = null;
  for (const line of body) {
    if (line === header) { inside = true; continue; }
    if (inside && !line.startsWith(' '.repeat(indent))) inside = false;
    if (!inside) continue;
    if (versionKey) {
      const name = new RegExp(`^ {${indent}}(\\S.*?):$`).exec(line);
      if (name) { pending = unquote(name[1]); continue; }
      const version = new RegExp(`^ {${indent + 2}}${versionKey}: (.+)$`).exec(line);
      if (version && pending) { result.push([pending, unquote(version[1])]); pending = null; }
    } else {
      const pair = new RegExp(`^ {${indent}}(\\S.*?): (.+)$`).exec(line);
      if (pair) result.push([unquote(pair[1]), unquote(pair[2])]);
    }
  }
  return result;
}

const resolutionOf = (body) => {
  const line = body.find((entry) => /^ {4}resolution: /.test(entry));
  return line ? line.replace(/^ {4}resolution: /, '').trim() : null;
};

function integrityOf(resolution) {
  const match = /integrity: ([^,}\s]+)/.exec(resolution ?? '');
  return match ? match[1] : (resolution ?? 'unresolved');
}

export function lockedIntegrity(text, name, version) {
  const body = entries(section(text, 'packages')).get(`${name}@${version}`);
  if (!body) throw new Error(`pnpm-lock.yaml does not lock ${name}@${version}`);
  const integrity = /integrity: ([^,}\s]+)/.exec(resolutionOf(body) ?? '');
  if (!integrity) throw new Error(`pnpm-lock.yaml has no integrity for ${name}@${version}`);
  return integrity[1];
}

export function lockedPackageSet(text, importerDir) {
  const importer = entries(section(text, 'importers')).get(importerDir);
  if (!importer) throw new Error(`pnpm-lock.yaml has no importer ${importerDir}`);
  const packages = entries(section(text, 'packages'));
  const snapshots = entries(section(text, 'snapshots'));
  const keyOf = (name, version) => (version.startsWith('npm:') ? version.slice(4) : `${name}@${version}`);
  const queue = [];
  for (const block of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    // importer entries sit at indent 4 (the block) / 6 (name) / 8 (specifier, version)
    for (const [name, version] of pairs(importer, block, 6, { versionKey: 'version' })) {
      if (!version.startsWith('link:')) queue.push(keyOf(name, version));
    }
  }
  const seen = new Set();
  while (queue.length) {
    const key = queue.pop();
    if (seen.has(key)) continue;
    seen.add(key);
    const body = snapshots.get(key);
    if (!body) throw new Error(`pnpm-lock.yaml has no snapshot for ${key}`);
    for (const block of ['dependencies', 'optionalDependencies']) {
      for (const [name, version] of pairs(body, block, 6)) queue.push(keyOf(name, version));
    }
  }
  const lines = new Set();
  for (const key of seen) {
    const id = baseVersion(key);
    const body = packages.get(id);
    if (!body) throw new Error(`pnpm-lock.yaml has no package entry for ${id}`);
    lines.add(`${id} ${integrityOf(resolutionOf(body))}`);
  }
  return [...lines].sort();
}

export function lockEvidenceSha256(text, importerDir) {
  return createHash('sha256').update(`${lockedPackageSet(text, importerDir).join('\n')}\n`).digest('hex');
}

/** The nearest pnpm-lock.yaml at or above `packageDir`, and the importer key of `packageDir` in it. */
export function readRepositoryLock(packageDir) {
  let directory = path.resolve(packageDir);
  for (;;) {
    const file = path.join(directory, 'pnpm-lock.yaml');
    if (existsSync(file)) {
      return { file, text: readFileSync(file, 'utf8'), importerDir: path.relative(directory, path.resolve(packageDir)).split(path.sep).join('/') || '.' };
    }
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error(`no pnpm-lock.yaml at or above ${packageDir}; run this from the OpenPresentation/opf checkout`);
    directory = parent;
  }
}
