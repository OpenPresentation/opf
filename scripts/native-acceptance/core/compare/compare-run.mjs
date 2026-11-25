#!/usr/bin/env node
// NT-04a: fill every slide's `compare` in a run directory (core/result/README.md) from OPF's preview pictures.
//
//   node scripts/native-acceptance/core/compare/compare-run.mjs --run <run dir> --preview <preview root>
//        [--pattern "{deck}/slide-{n}.png"] [--width 1280] [--blur 1.5] [--tolerance 24] [--shift 2] [--boxes 5]
//
// The preview root holds OPF's previews as qualification/build.mjs writes them (`<out>/preview/<deck>/slide-<n>.png`, one
// picture per visible slide, numbered 1..n); --pattern names another layout relative to the root ("{deck}/preview/slide-{n}.png"
// for the 0.36.0 round's per-deck build folders). Every variant of a deck compares with the deck's one preview.
//
// Where the preview lives: `compare.preview` is relative to the run directory, always `preview/<deck>/slide-<n>.png`. When the
// preview root is not already the run directory's own `preview/` folder, the pictures used are copied there, so a run
// directory stands alone (a later classify, a sheet or a reviewer needs nothing outside it) and no path names a machine.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateResult, validateRun } from '../result/result.mjs';
import { comparePictures, DEFAULTS, loadPicture, pairSlides } from './picture.mjs';

export const DEFAULT_PATTERN = '{deck}/slide-{n}.png';

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
// The preview keeps its file name: preview/<deck>/slide-<n>.png.
const runPreviewPath = (deck, name) => `preview/${deck}/${name}`;

/**
 * The preview pictures of one deck in slide order: the files the pattern matches, `{n}` any number with or without leading
 * zeros, sorted by that number. OPF numbers its previews 1..n over the visible slides; an older build numbered them by slide
 * index and left the hidden ones out (slide-08.png, slide-10.png). Either way the k-th picture is the k-th visible slide's.
 */
export function previewPictures(previewRoot, deck, pattern = DEFAULT_PATTERN) {
  const relative = pattern.replaceAll('{deck}', deck);
  const directory = path.join(previewRoot, path.dirname(relative));
  if (!existsSync(directory)) return [];
  const escaped = path.basename(relative).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const shape = new RegExp(`^${escaped.replace('\\{n\\}', '(\\d+)')}$`, 'u');
  return readdirSync(directory)
    .map((name) => [name, shape.exec(name)])
    .filter(([, match]) => match)
    .sort((a, b) => Number(a[1][1]) - Number(b[1][1]))
    .map(([name]) => path.join(directory, name));
}

/**
 * Compares one result's slides with the deck's previews and returns the result with `compare` on every slide.
 *   compareResult(result, { fileDir, runDir, previews: [paths], copy: boolean, options })
 */
export async function compareResult(result, { fileDir, runDir, previews, copy = true, options = {} }) {
  const deck = result.file.deck;
  const pairs = pairSlides(result.slides, previews.length);
  const slides = [];
  for (const [position, slide] of result.slides.entries()) {
    const pair = pairs[position];
    const preview = pair.preview === null ? null : runPreviewPath(deck, path.basename(previews[pair.preview - 1]));
    if (preview && copy) {
      const target = path.join(runDir, preview);
      if (!existsSync(target)) {
        mkdirSync(path.dirname(target), { recursive: true });
        copyFileSync(previews[pair.preview - 1], target);
      }
    }
    let compare;
    if (pair.note) {
      compare = { preview, score: null, note: pair.note };
    } else {
      const picture = path.join(fileDir, pair.picture);
      if (!existsSync(picture)) {
        compare = { preview, score: null, note: `no application picture (${pair.picture} is missing)` };
      } else {
        const found = await comparePictures(await loadPicture(previews[pair.preview - 1]), await loadPicture(picture), options);
        compare = { preview, score: found.score, aspectDiffers: found.aspectDiffers, regions: found.regions };
      }
    }
    slides.push({ ...slide, compare });
  }
  return { ...result, slides };
}

/**
 * Fills `compare` in every result.json of a run directory and writes each back after validating it.
 * Returns { files, compared, unpaired, scores: { "<fileId>": [score|null per slide] } }.
 */
export async function compareRun(runDir, { preview, pattern = DEFAULT_PATTERN, options = {}, log = () => {} } = {}) {
  if (!preview) throw new Error('compareRun: pass the preview root (options.preview)');
  const run = readJson(path.join(runDir, 'run.json'));
  const checked = validateRun(run);
  if (!checked.ok) throw new Error(`compareRun: run.json is not valid:\n${checked.errors.join('\n')}`);
  const copy = path.resolve(preview) !== path.resolve(runDir, 'preview') || pattern !== DEFAULT_PATTERN;
  const summary = { files: 0, compared: 0, unpaired: 0, scores: {} };
  for (const entry of run.files) {
    const resultFile = path.join(runDir, entry.result);
    const result = readJson(resultFile);
    const previews = previewPictures(preview, result.file.deck, pattern);
    const compared = await compareResult(result, { fileDir: path.dirname(resultFile), runDir, previews, copy, options });
    const valid = validateResult(compared);
    if (!valid.ok) throw new Error(`compareRun: ${entry.result} is not valid after compare:\n${valid.errors.join('\n')}`);
    writeFileSync(resultFile, `${JSON.stringify(compared, null, 2)}\n`);
    summary.files += 1;
    summary.scores[entry.id] = compared.slides.map((slide) => slide.compare.score);
    for (const slide of compared.slides) {
      if (slide.compare.score === null) summary.unpaired += 1;
      else summary.compared += 1;
    }
    log(`${entry.id}: ${compared.slides.map((slide) => (slide.compare.score === null ? '-' : slide.compare.score.toFixed(3))).join(' ')}`);
  }
  return summary;
}

export function parseArgs(argv) {
  const options = { pattern: DEFAULT_PATTERN, compare: {} };
  const numbers = { '--width': 'width', '--blur': 'blur', '--tolerance': 'tolerance', '--shift': 'shift', '--boxes': 'boxes' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--run') options.run = argv[++index];
    else if (arg === '--preview') options.preview = argv[++index];
    else if (arg === '--pattern') options.pattern = argv[++index];
    else if (arg in numbers) {
      const value = Number(argv[++index]);
      if (!Number.isFinite(value)) throw new Error(`${arg} needs a number`);
      options.compare[numbers[arg]] = value;
    } else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`unknown argument ${arg}`);
  }
  return options;
}

async function main(argv) {
  const options = parseArgs(argv);
  if (options.help || !options.run || !options.preview) {
    console.log(`usage: compare-run.mjs --run <run dir> --preview <preview root> [--pattern "${DEFAULT_PATTERN}"] [--width ${DEFAULTS.width}] [--blur ${DEFAULTS.blur}] [--tolerance ${DEFAULTS.tolerance}] [--shift ${DEFAULTS.shift}] [--boxes ${DEFAULTS.boxes}]`);
    return options.help ? 0 : 2;
  }
  const summary = await compareRun(options.run, { preview: options.preview, pattern: options.pattern, options: options.compare, log: (line) => console.log(line) });
  console.log(`${summary.files} files: ${summary.compared} slides compared, ${summary.unpaired} without a pair`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(error.message);
      process.exit(2);
    },
  );
}
