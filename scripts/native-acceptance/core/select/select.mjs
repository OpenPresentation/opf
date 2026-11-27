// NT-13: the release-candidate tier (`pnpm native <target> --tier candidate`). The runner builds every release-tier file
// (building opens no application), hashes what each file's slides draw (slide-parts.mjs) and sends to the application only:
//   - the smoke tier's files,
//   - the files the changelog fragments' `native:` slides or --look name (their default export),
//   - the files with a slide whose hash differs from the baseline summary's, or that the baseline does not have,
//   - every file whose deck hash (masters, used layouts, theme, presentation properties) differs from the baseline's.
// A baseline without hashes (0.36.0 has none) cannot say what changed: the selection is then the smoke tier and the named
// files, and the table says so.
import { fileId } from '../result/result.mjs';
import { exportHashesOfFile } from './slide-parts.mjs';

/** The tier name a run uses for this selection; the manifest's tiers stay smoke, release and full. */
export const CANDIDATE = 'candidate';

/** True when a baseline (a summary, or readBaseline's value) has export hashes for at least one file. */
export function hasHashes(baseline) {
  if (!baseline) return false;
  const files = baseline.files instanceof Map ? [...baseline.files.values()] : (baseline.files ?? []);
  return files.some((file) => file.export);
}

const baseFile = (baseline, id) => (baseline.files instanceof Map ? baseline.files.get(id) : baseline.files.find((file) => file.id === id)) ?? null;

/**
 * How one file's export differs from the baseline's.
 *   exportChange(hashes, base) -> { status: 'unknown'|'new'|'deck'|'slides'|'same', slides: [changed slide numbers] }
 * `hashes` is exportHashes' value, `base` the baseline file entry (with `export`) or null. A slide the baseline lacks counts
 * as changed. 'deck' means the deck hash differs: every slide counts as changed.
 */
export function exportChange(hashes, base, baselineHasHashes = true) {
  if (!hashes || !baselineHasHashes) return { status: 'unknown', slides: [] };
  if (!base?.export) return { status: 'new', slides: hashes.slides.map((_, index) => index + 1) };
  if (base.export.deck !== hashes.deck) return { status: 'deck', slides: hashes.slides.map((_, index) => index + 1) };
  const slides = hashes.slides.map((hash, index) => (base.export.slides[index] === hash ? 0 : index + 1)).filter(Boolean);
  return { status: slides.length > 0 ? 'slides' : 'same', slides };
}

/** The smoke tier's file ids: [ids] from decksForTier(manifest, 'smoke'). */
export const smokeIds = (smokeDecks) => smokeDecks.flatMap((entry) => entry.variants.map((variant) => fileId(entry.deck, variant)));

const compactList = (numbers) => {
  const out = [];
  for (const number of numbers) {
    const last = out.at(-1);
    if (last && number === last[1] + 1) last[1] = number;
    else out.push([number, number]);
  }
  return out.map(([from, to]) => (from === to ? `${from}` : `${from}-${to}`)).join(', ');
};

/**
 * The files a candidate run opens.
 *   selectCandidate({ files: [{ id, deck, variant, hashes }], smoke: [ids], named: [{ deck, reason }], baseline, baselineVersion })
 *   -> { selected: [{ id, reasons }], skipped: [ids], changes: Map id -> exportChange, hashes: boolean, changedSlides, deckChanged: [ids] }
 * `files` are the built release-tier files (hashes null when a file could not be hashed: it is selected), `named` the decks
 * of fragments and --look (their default export is selected), `baseline` the baseline summary or null.
 */
export function selectCandidate({ files, smoke = [], named = [], baseline = null, baselineVersion = null }) {
  const withHashes = hasHashes(baseline);
  const smokeSet = new Set(smoke);
  const selected = [];
  const skipped = [];
  const changes = new Map();
  const deckChanged = [];
  let changedSlides = 0;
  const since = baselineVersion ? ` since ${baselineVersion}` : '';
  for (const file of files) {
    const reasons = [];
    if (smokeSet.has(file.id)) reasons.push('smoke tier');
    for (const item of named) if (item.deck === file.deck && file.variant === 'default' && !reasons.includes(item.reason)) reasons.push(item.reason);
    const change = exportChange(file.hashes, baseline ? baseFile(baseline, file.id) : null, withHashes);
    changes.set(file.id, change);
    if (withHashes) {
      if (!file.hashes) reasons.push('its slides could not be hashed');
      else if (change.status === 'new') reasons.push(`not in the ${baselineVersion ? `${baselineVersion} ` : ''}baseline`);
      else if (change.status === 'deck') {
        reasons.push(`deck-level parts changed${since} (masters, layouts, theme or presentation properties): every slide`);
        deckChanged.push(file.id);
      } else if (change.status === 'slides') reasons.push(`${change.slides.length} slide(s) changed${since}: ${compactList(change.slides)}`);
      if (change.status !== 'unknown' && change.status !== 'same') changedSlides += change.slides.length;
    }
    if (reasons.length > 0) selected.push({ id: file.id, reasons });
    else skipped.push(file.id);
  }
  return { selected, skipped, changes, hashes: withHashes, changedSlides, deckChanged };
}

/** The table printed before the run step: lines of text. */
export function selectionTable(selection, { total, baselineVersion = null }) {
  const lines = [];
  if (!selection.hashes) lines.push(`the baseline ${baselineVersion ?? '(none)'} has no export hashes: selecting the smoke tier and the files changes name, without change detection`);
  const width = Math.max(4, ...selection.selected.map((item) => item.id.length));
  lines.push(`  files in the release tier  ${total}`);
  lines.push(`  unchanged, skipped         ${selection.skipped.length}`);
  lines.push(`  selected                   ${selection.selected.length}`);
  lines.push(`  slides changed             ${selection.hashes ? selection.changedSlides : 'unknown'}`);
  if (selection.deckChanged.length > 0) lines.push(`  deck-level change in ${selection.deckChanged.length} file(s): every slide of them is selected (${selection.deckChanged.join(', ')})`);
  for (const item of selection.selected) lines.push(`  ${item.id.padEnd(width)}  ${item.reasons.join('; ')}`);
  return lines;
}

/**
 * The export hashes of a run's files, from the exported files beside it: Map id -> { deck, slides }. A file whose bytes
 * differ from result.file.sha256 (or that is missing) is left out and named in `notes`.
 *   exportsOfResults(results, inputRoot, { hash }) -> { exports, notes }
 */
export function exportsOfResults(results, inputRoot, { hash = exportHashesOfFile, sha256 } = {}) {
  const exports = new Map();
  const notes = [];
  if (!inputRoot) return { exports, notes: results.length ? ['no exported files beside the run: no export hashes'] : [] };
  for (const result of results) {
    const file = `${inputRoot}/${result.file.path}`;
    try {
      if (sha256 && sha256(file) !== result.file.sha256) {
        notes.push(`${result.file.id}: the exported file beside the run is not the file that was opened; no export hashes`);
        continue;
      }
      exports.set(result.file.id, hash(file));
    } catch (problem) {
      notes.push(`${result.file.id}: no export hashes (${problem.code === 'ENOENT' ? 'the exported file is missing' : problem.message})`);
    }
  }
  return { exports, notes };
}
