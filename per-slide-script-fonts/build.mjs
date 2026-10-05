// opf-pptx#168 probe set: per-slide script fonts (one slide master per script profile).
// node build.mjs <opf-pptx base checkout> <opf-pptx fix checkout>
//   base = codex/rr-17-pptxgenjs-plus 3fb1387 (before the fix), fix = codex/rr-17-per-slide-script-fonts.
// Writes decks/*.pptx and manifest.json. Both checkouts need node_modules (npm ci) and a built dist/.
import {createHash} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {unzipSync, strFromU8} from 'fflate';

const [baseDir, fixDir] = process.argv.slice(2).map(dir => path.resolve(dir));
const load = dir => import(pathToFileURL(path.join(dir, 'dist/index.js')).href);
const [base, fix] = [await load(baseDir), await load(fixDir)];
const head = dir => execFileSync('git', ['-C', dir, 'rev-parse', '--short', 'HEAD']).toString().trim();
const OPTIONS = {seed: 1, timestamp: '2026-10-05T00:00:00Z', zipDate: '2026-10-05T00:00:00Z'};
const inline = (slot, family) => ({major: 'Arial', minor: 'Arial', [slot]: {major: family, minor: family}});

const ja = 'ひらがなとカタカナと漢字', ar = 'مرحبا بالعالم العربي', hi = 'नमस्ते दुनिया हिंदी', th = 'ภาษาไทยเป็นภาษาที่มีวรรณยุกต์';
// Each slide: the families its East Asian / complex-script text must read natively.
const DECKS = {
  'a-three-profiles': {
    title: '(a) Three per-slide script profiles: Japanese Meiryo, Arabic Traditional Arabic, Hindi Nirmala UI (latin Arial)',
    document: {name: 'Three script profiles', slides: [
      {title: 'Japanese 日本語', design: {fontScheme: inline('eastAsian', 'Meiryo')}, text: ja},
      {title: 'Arabic مرحبا', design: {fontScheme: inline('complexScript', 'Traditional Arabic')}, text: ar, notes: 'ملاحظات المتحدث'},
      {title: 'Hindi नमस्ते', design: {fontScheme: inline('complexScript', 'Nirmala UI')}, text: hi},
    ]},
    expect: {fonts: ['Arial', 'Meiryo', 'Traditional Arabic', 'Nirmala UI'], slides: [
      {master: 1, script: ja, slot: 'nameFarEast', family: 'Meiryo'},
      {master: 2, script: ar, slot: 'nameComplexScript', family: 'Traditional Arabic'},
      {master: 3, script: hi, slot: 'nameComplexScript', family: 'Nirmala UI'},
    ]},
    before: true,
  },
  'a2-thai-repro': {
    title: '(a2) The opf-pptx#168 repro: Thai, slide 1 Angsana New, slide 2 DilleniaUPC (catalog font schemes)',
    document: {name: 'Per-slide script font', language: 'th', design: {theme: 'classic', dimensions: 'widescreen'}, slides: [
      {id: 'one', title: 'รายงานสรุปผล', design: {fontScheme: 'angsana-new'}, blocks: [{text: th}]},
      {id: 'two', title: 'รายงานสรุปผล', design: {fontScheme: 'dilleniaupc'}, blocks: [{text: th}]},
    ]},
    expect: {fonts: ['Angsana New', 'DilleniaUPC'], slides: [
      {master: 1, script: th, slot: 'nameComplexScript', family: 'Angsana New'},
      {master: 2, script: th, slot: 'nameComplexScript', family: 'DilleniaUPC'},
    ]},
    before: true,
  },
  'b-single-profile': {
    title: '(b) One script profile (Japanese, Meiryo through the language; per-slide Latin-only font schemes): byte-identical before and after',
    document: {name: 'Single profile', language: 'japanese', slides: [
      {title: '日本語の見出し', text: ja, notes: 'メモ'},
      {title: '日本語の見出し', design: {fontScheme: 'georgia'}, text: ja},
      {title: '日本語の見出し', design: {fontScheme: 'meiryo'}, text: ja},
    ]},
    expect: {fonts: ['Aptos', 'Aptos Display', 'Georgia', 'Meiryo'], slides: [
      {master: 1, script: ja, slot: 'nameFarEast', family: 'Meiryo'},
      {master: 1, script: ja, slot: 'nameFarEast', family: 'Meiryo'},
      {master: 1, script: ja, slot: 'nameFarEast', family: 'Meiryo'},
    ]},
    before: true,
    identical: true,
  },
  'c-mixed-default': {
    title: '(c) A per-slide override mixed with the deck default: Japanese (Meiryo through the language), slides 2 and 4 MS Mincho',
    document: {name: 'Mixed', language: 'japanese', slides: [
      {title: '日本語の見出し', text: ja, notes: 'メモ'},
      {title: '日本語の見出し', design: {fontScheme: 'ms-mincho'}, text: ja},
      {title: '日本語の見出し', text: ja, notes: 'メモ'},
      {title: '日本語の見出し', design: {fontScheme: 'ms-mincho'}, text: ja},
    ]},
    expect: {fonts: ['Aptos', 'Aptos Display', 'Meiryo', 'MS Mincho'], slides: [
      {master: 1, script: ja, slot: 'nameFarEast', family: 'Meiryo'},
      {master: 2, script: ja, slot: 'nameFarEast', family: 'MS Mincho'},
      {master: 1, script: ja, slot: 'nameFarEast', family: 'Meiryo'},
      {master: 2, script: ja, slot: 'nameFarEast', family: 'MS Mincho'},
    ]},
  },
};

const fontsUsed = app => {
  const pairs = [...(/<HeadingPairs>([\s\S]*?)<\/HeadingPairs>/.exec(app)?.[1] ?? '').matchAll(/<vt:(lpstr|i4)>([^<]*)<\/vt:\1>/g)].map(match => match[2]);
  const titles = [...(/<TitlesOfParts>([\s\S]*?)<\/TitlesOfParts>/.exec(app)?.[1] ?? '').matchAll(/<vt:lpstr>([^<]*)<\/vt:lpstr>/g)].map(match => match[1]);
  let offset = 0;
  for (let index = 0; index + 1 < pairs.length; index += 2) {
    if (pairs[index] === 'Fonts Used') return titles.slice(offset, offset + Number(pairs[index + 1]));
    offset += Number(pairs[index + 1]);
  }
  return [];
};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const facts = bytes => {
  const entries = unzipSync(bytes), text = name => strFromU8(entries[name]);
  const app = text('docProps/app.xml');
  return {
    bytes: bytes.byteLength, sha256: sha(bytes),
    slideMasters: Object.keys(entries).filter(name => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(name)).length,
    themes: Object.keys(entries).filter(name => /^ppt\/theme\/theme\d+\.xml$/.test(name)).sort(),
    fontsUsed: fontsUsed(app),
    runEaCs: Object.keys(entries).filter(name => /^ppt\/(?:slides\/slide|notesSlides\/notesSlide)\d+\.xml$/.test(name) && /<a:(?:ea|cs)\s+typeface="(?!\+)/.test(text(name))).length,
  };
};

await mkdir(new URL('./decks/', import.meta.url), {recursive: true});
const manifest = {
  item: 'FF-05 per-slide script fonts (opf-pptx#168): one slide master and theme per script profile',
  builds: {before: {checkout: `opf-pptx codex/rr-17-pptxgenjs-plus ${head(baseDir)}`}, after: {checkout: `opf-pptx codex/rr-17-per-slide-script-fonts ${head(fixDir)}`}},
  options: OPTIONS,
  pass: [
    'Every deck opens without a repair prompt and reads stage: done.',
    'Presentation.Fonts lists no empty name and nothing outside expect.fonts (the families the deck names); the accepted RR-05 reading is that PowerPoint may omit theme-only script families.',
    'after decks: on every slide the runs holding expect.script read expect.slot (NameFarEast or NameComplexScript) = expect.family, and the slide uses master expect.master (Designs order).',
    'before decks (a, a2): expected to FAIL the per-slide check from slide 2 on (they read slide 1\'s family): the opf-pptx#168 baseline.',
    'b-single-profile: before and after are byte-identical (same sha256) and read the same.',
  ],
  decks: {},
};
for (const [id, deck] of Object.entries(DECKS)) {
  const files = {};
  const after = await fix.toPptx(structuredClone(deck.document), {...OPTIONS, onDiagnostic: diagnostic => (files.afterDiagnostics ??= []).push(`${diagnostic.code} ${diagnostic.path}`)});
  await writeFile(new URL(`./decks/${id}-after.pptx`, import.meta.url), after);
  files.after = {file: `${id}-after.pptx`, ...facts(after)};
  if (deck.before) {
    const before = await base.toPptx(structuredClone(deck.document), OPTIONS);
    await writeFile(new URL(`./decks/${id}-before.pptx`, import.meta.url), before);
    files.before = {file: `${id}-before.pptx`, ...facts(before)};
    if (deck.identical && files.before.sha256 !== files.after.sha256) throw new Error(`${id}: before and after differ`);
  }
  manifest.decks[id] = {title: deck.title, document: deck.document, expect: deck.expect, files};
}
await writeFile(new URL('./manifest.json', import.meta.url), `${JSON.stringify(manifest, null, 2)}\n`);
for (const [id, {files}] of Object.entries(manifest.decks)) console.log(id, 'after', files.after.slideMasters, 'masters', files.after.sha256.slice(0, 12), files.before ? `before ${files.before.slideMasters} masters ${files.before.sha256.slice(0, 12)}` : '', files.afterDiagnostics ?? '');
