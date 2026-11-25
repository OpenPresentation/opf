#!/usr/bin/env node
// NT-04a: turn one folder of the 0.36.0 Keynote round's recorded output into a run directory of the shared format
// (core/result/README.md), so the recorded round can be compared, classified and used as the first baseline. It reads
// files only and never talks to Keynote.
//
//   node scripts/native-acceptance/apps/keynote/import-recorded.mjs --from <recorded folder> --out <new run dir>
//        --opf <version> [--opf-commit <sha>] --os-version <macOS version> [--build <Keynote build>] [--input-root <dir>]
//        [--split tilde|none] [--variant <name>] [--tier smoke|release|full] [--fonts installed] [--force]
//
// The recorded folder holds one subfolder per file (kn-run's output): run.json, probe.json, slides/slide-NN.png (numbered by
// Keynote's slide number, hidden slides absent) and back.pptx. Per file this writes files/<deck>~<variant>/result.json
// (apps/keynote/normalize.mjs), copies the pictures to slides/slide-00N.png by slide index and back.pptx to resaved.pptx;
// then run.json. What the recorded files cannot say comes from the command line: the OPF version that exported the files,
// the system version, Keynote's build, and how a recorded name splits into deck and variant (--split tilde: "<deck>~<variant>",
// variant "default" when there is no "~"; --split none: the whole name is the deck and --variant names the variant).
// A picture or back.pptx the folder does not have is left out: the slide's picture is null and the verb's message says so.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pictureFacts } from '../../core/compare/picture.mjs';
import { runFileEntry, SCHEMA_VERSION, validateResult, validateRun } from '../../core/result/result.mjs';
import { normalize } from './normalize.mjs';

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const addMessage = (verb, text) => {
  verb.message = verb.message ? `${verb.message}; ${text}` : text;
};

/** The recorded file folders under `from`, in the order the round ran them (started, then name). */
export function recordedFolders(from) {
  return readdirSync(from, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_') && existsSync(path.join(from, entry.name, 'run.json')))
    .map((entry) => ({ name: entry.name, dir: path.join(from, entry.name), run: readJson(path.join(from, entry.name, 'run.json')) }))
    .sort((a, b) => String(a.run.started).localeCompare(String(b.run.started)) || a.name.localeCompare(b.name));
}

function splitName(name, { split = 'tilde', variant = 'default' }) {
  if (split === 'none') return { deck: name, variant };
  if (split !== 'tilde') throw new Error(`import-recorded: --split must be tilde or none, not "${split}"`);
  const [deck, named] = name.split('~');
  return { deck, variant: named ?? variant };
}

/**
 * One recorded file folder -> { result, copies: [[from, to]] } with `to` relative to the file's folder in the run directory.
 * Pictures and back.pptx that are missing make the slide's picture null and add a message to render / resave.
 */
export async function importFile(folder, options) {
  const { run } = folder;
  const probeFile = path.join(folder.dir, 'probe.json');
  const probe = existsSync(probeFile) ? readJson(probeFile) : null;
  const names = splitName(run.name, options);
  const application = options.build ? { build: options.build } : undefined;
  const result = normalize(
    { run, probe },
    { opf: options.opf, system: options.system, fonts: options.fonts, inputRoot: options.inputRoot, deck: names.deck, variant: names.variant, application },
  );
  const copies = [];
  // run.json "pictures": { "slide-01.png": { "slide": 1 } }: Keynote's slide number is the slide's index (hidden slides counted).
  const recordedName = new Map(Object.entries(run.pictures ?? {}).map(([file, picture]) => [picture.slide, file]));
  const missing = [];
  let facts = null;
  for (const slide of result.slides) {
    if (slide.picture === null) continue;
    const source = path.join(folder.dir, 'slides', recordedName.get(slide.index) ?? '');
    if (!recordedName.has(slide.index) || !existsSync(source)) {
      missing.push(recordedName.get(slide.index) ?? `slide ${slide.index}`);
      slide.picture = null;
      continue;
    }
    facts ??= await pictureFacts(source);
    copies.push([source, slide.picture]);
  }
  if (missing.length > 0) addMessage(result.verbs.render, `not in the recorded folder: ${missing.join(', ')}`);
  if (facts) {
    result.verbs.render.pixelSize = facts.pixelSize;
    if (facts.colorProfile) result.verbs.render.colorProfile = facts.colorProfile;
    result.verbs.render.alpha = facts.alpha;
  }
  if (result.verbs.resave.status === 'done') {
    const back = path.join(folder.dir, 'back.pptx');
    if (existsSync(back)) copies.push([back, 'resaved.pptx']);
    else {
      delete result.verbs.resave.path;
      addMessage(result.verbs.resave, 'back.pptx was not in the recorded folder');
    }
  }
  return { result, copies };
}

/** The run.json of a set of results. */
export function runOf(results, { tier = null, baseline = null } = {}) {
  const [first] = results;
  return {
    schemaVersion: SCHEMA_VERSION,
    target: first.target,
    application: first.application,
    system: first.system,
    fonts: first.fonts,
    opf: first.opf,
    tier,
    baseline,
    started: results.map((result) => result.started).sort()[0],
    finished: results
      .map((result) => result.finished)
      .sort()
      .at(-1),
    check: { status: 'ready', reasons: [] },
    files: results.map(runFileEntry),
  };
}

/**
 * Imports a recorded folder into a new run directory. Returns { run, results }.
 *   importRecorded(from, out, { opf: { version, commit? }, system: { os, version }, build?, fonts?, inputRoot?, split?, variant?,
 *                              tier?, force? })
 */
export async function importRecorded(from, out, options) {
  if (existsSync(path.join(out, 'run.json')) && !options.force) throw new Error(`import-recorded: ${out} already has a run.json (pass --force to write over it)`);
  const folders = recordedFolders(from);
  if (folders.length === 0) throw new Error(`import-recorded: no recorded files (subfolders with run.json) in ${from}`);
  const results = [];
  for (const folder of folders) {
    const { result, copies } = await importFile(folder, options);
    const checked = validateResult(result);
    if (!checked.ok) throw new Error(`import-recorded: ${folder.name} does not make a valid result.json:\n${checked.errors.join('\n')}`);
    if (results.some((other) => other.file.id === result.file.id)) throw new Error(`import-recorded: two recorded folders make the file id ${result.file.id}`);
    const fileDir = path.join(out, 'files', result.file.id);
    mkdirSync(path.join(fileDir, 'slides'), { recursive: true });
    for (const [source, target] of copies) copyFileSync(source, path.join(fileDir, target));
    writeFileSync(path.join(fileDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
    results.push(result);
  }
  const run = runOf(results, options);
  const checked = validateRun(run);
  if (!checked.ok) throw new Error(`import-recorded: run.json is not valid:\n${checked.errors.join('\n')}`);
  writeFileSync(path.join(out, 'run.json'), `${JSON.stringify(run, null, 2)}\n`);
  return { run, results };
}

export function parseArgs(argv) {
  const options = { system: { os: 'macOS' }, opf: {} };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = () => {
      const next = argv[++index];
      if (next === undefined) throw new Error(`${arg} needs a value`);
      return next;
    };
    if (arg === '--from') options.from = value();
    else if (arg === '--out') options.out = value();
    else if (arg === '--opf') options.opf.version = value();
    else if (arg === '--opf-commit') options.opf.commit = value();
    else if (arg === '--os-version') options.system.version = value();
    else if (arg === '--build') options.build = value();
    else if (arg === '--input-root') options.inputRoot = value();
    else if (arg === '--split') options.split = value();
    else if (arg === '--variant') options.variant = value();
    else if (arg === '--tier') options.tier = value();
    else if (arg === '--fonts') options.fonts = value();
    else if (arg === '--force') options.force = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`unknown argument ${arg}`);
  }
  return options;
}

async function main(argv) {
  const options = parseArgs(argv);
  if (options.help || !options.from || !options.out || !options.opf.version || !options.system.version) {
    console.log('usage: import-recorded.mjs --from <recorded folder> --out <new run dir> --opf <version> --os-version <macOS version> [--opf-commit <sha>] [--build <Keynote build>] [--input-root <dir>] [--split tilde|none] [--variant <name>] [--tier smoke|release|full] [--fonts installed] [--force]');
    return options.help ? 0 : 2;
  }
  const { run } = await importRecorded(options.from, options.out, options);
  const slides = run.files.reduce((sum, file) => sum + (file.slideCount ?? 0), 0);
  console.log(`${run.files.length} files, ${slides} slides -> ${options.out}`);
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
