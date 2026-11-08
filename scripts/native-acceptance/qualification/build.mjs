#!/usr/bin/env node
// Release qualification corpus: export every deck of manifest.json to PPTX (one file per variant) and to OPF's own preview PNGs,
// with the hashes a native run records. Platform-neutral; run it from a built checkout (`pnpm build`) with the workspace CLI:
//
//   node scripts/native-acceptance/qualification/build.mjs --out <new-or-empty-dir> [--only <deck-id>[,<deck-id>...]]
//
// Writes <out>/pptx/<deck>[~<variant>].pptx, <out>/preview/<deck>/slide-<n>.png (1280 x 720 reference size) and <out>/build.json
// (checkout revision, package version, Node, per-deck source and PPTX hashes and every finding the export reported). The native
// runners (run-powerpoint-windows.ps1, and the Mac and LibreOffice streams) read build.json; nothing generated is committed.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const cli = path.join(root, 'packages/cli/dist/index.js');

export function parseArgs(argv) {
  const options = { only: undefined, out: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--out') options.out = argv[++index];
    else if (arg === '--only') options.only = new Set(argv[++index].split(','));
    else throw new Error(`Unknown argument ${arg}`);
  }
  if (!options.out) throw new Error('--out <dir> is required');
  return options;
}

export function loadManifest() {
  return JSON.parse(readFileSync(path.join(here, 'manifest.json'), 'utf8'));
}

export function pptxName(deck, variant) {
  return variant.name === 'default' ? `${deck.id}.pptx` : `${deck.id}~${variant.name}.pptx`;
}

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

function convert(args) {
  try {
    return { ok: true, report: JSON.parse(execFileSync(process.execPath, [cli, 'convert', ...args, '--force'], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 })) };
  } catch (error) {
    let report;
    try { report = JSON.parse(error.stdout); } catch { report = { error: String(error.stderr || error.message).slice(0, 2000) }; }
    return { ok: false, report };
  }
}

const findingsOf = (report) => (report.findings ?? []).map((finding) => ({ ruleId: finding.ruleId, severity: finding.severity, path: finding.path, message: finding.message }));

function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = loadManifest();
  const out = path.resolve(options.out);
  for (const sub of ['pptx', 'preview']) mkdirSync(path.join(out, sub), { recursive: true });
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const version = JSON.parse(readFileSync(path.join(root, 'packages/javascript/package.json'), 'utf8')).version;
  const decks = [];
  for (const deck of manifest.decks) {
    if (options.only && !options.only.has(deck.id)) continue;
    const source = path.join(root, deck.source);
    const assetDir = path.dirname(source);
    const previewDir = path.join(out, 'preview', deck.id);
    mkdirSync(previewDir, { recursive: true });
    const preview = convert([source, path.join(previewDir, 'slide-{n}.png'), '--scale', '1', '--asset-dir', assetDir]);
    const previews = readdirSync(previewDir).filter((name) => /^slide-\d+\.png$/.test(name)).length;
    const record = { id: deck.id, source: deck.source, sourceSha256: sha256(source), previewOk: preview.ok, previewSlides: previews, previewFindings: findingsOf(preview.report), variants: [] };
    if (!preview.ok) record.previewError = preview.report.error ?? preview.report;
    for (const variant of deck.variants ?? [{ name: 'default', flags: [] }]) {
      const file = path.join(out, 'pptx', pptxName(deck, variant));
      const result = convert([source, file, '--asset-dir', assetDir, ...(variant.flags ?? [])]);
      record.variants.push({ name: variant.name, flags: variant.flags ?? [], pptx: path.relative(out, file).replaceAll('\\', '/'), ok: result.ok, sha256: result.ok ? sha256(file) : undefined, findings: findingsOf(result.report), ...(result.ok ? {} : { error: result.report.error ?? result.report }) });
    }
    decks.push(record);
    process.stdout.write(`${deck.id}: preview ${preview.ok ? previews : 'FAILED'}, ${record.variants.map((v) => `${v.name} ${v.ok ? 'ok' : 'FAILED'}`).join(', ')}\n`);
  }
  // --only rebuilds those decks and keeps the others' records of an earlier build of the same revision.
  const previous = path.join(out, 'build.json');
  if (options.only && existsSync(previous)) {
    const earlier = JSON.parse(readFileSync(previous, 'utf8'));
    if (earlier.revision === revision) {
      const rebuilt = new Map(decks.map((deck) => [deck.id, deck]));
      const order = manifest.decks.map((deck) => deck.id);
      const merged = [...earlier.decks.filter((deck) => !rebuilt.has(deck.id)), ...decks];
      decks.splice(0, decks.length, ...merged.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)));
    }
  }
  writeFileSync(previous, `${JSON.stringify({ manifestVersion: manifest.version, revision, opfVersion: version, node: process.version, platform: `${process.platform}-${process.arch}`, builtAt: new Date().toISOString(), decks }, null, 2)}\n`);
  const failed = decks.flatMap((deck) => [...(deck.previewOk ? [] : [`${deck.id} preview`]), ...deck.variants.filter((v) => !v.ok).map((v) => `${deck.id}~${v.name}`)]);
  if (failed.length) { console.error(`failed: ${failed.join(', ')}`); process.exitCode = 1; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
