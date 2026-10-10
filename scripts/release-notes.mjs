#!/usr/bin/env node
// Release notes for a version from a CHANGELOG: the body of its `## X.Y.Z` section, up to the next `## ` heading.
// The assembler writes `## X.Y.Z (YYYY-MM-DD)` headings (scripts/changelog-fragments.mjs); a bare `## X.Y.Z` is accepted
// too. The version is matched whole, so 0.18.1 never selects the 0.18.10 section. Used by the "Create GitHub Release" job of
// .github/workflows/npm-publish.yml.
//
//   node scripts/release-notes.mjs --version 0.18.1 [--changelog CHANGELOG.md] [--out notes.md]
//
// Prints the notes (or writes them to --out); prints nothing when the version has no section or an empty one.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The notes of `version` in `changelog` text: trimmed of leading and trailing blank lines, '' when there is no section. */
export function extractReleaseNotes(changelog, version) {
  const heading = new RegExp(`^## ${escapeRegExp(version)}(?: \\(.*\\))?\\s*$`);
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) return '';
  let end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  if (end === -1) end = lines.length;
  return lines.slice(start + 1, end).join('\n').replace(/^\s*\n/, '').trimEnd();
}

function main(argv) {
  const options = { changelog: 'CHANGELOG.md' };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    if (!['version', 'changelog', 'out'].includes(key) || argv[i + 1] === undefined) {
      console.error('Usage: node scripts/release-notes.mjs --version X.Y.Z [--changelog CHANGELOG.md] [--out notes.md]');
      return 2;
    }
    options[key] = argv[i + 1];
  }
  if (!options.version) {
    console.error('release-notes: --version is required');
    return 2;
  }
  const notes = extractReleaseNotes(readFileSync(options.changelog, 'utf8'), options.version);
  const text = notes ? `${notes}\n` : '';
  if (options.out) writeFileSync(options.out, text);
  else process.stdout.write(text);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
