// FF-46 / opf#375 probe set: the theme script supplement of a latin-slot script (Ethi, Armn, Geor) names the chosen scheme family.
//   node build.mjs <side> <opf-pptx checkout>            side = before | after, run with the core named by OPF_CORE_DIST
//        (node --import <core>/scripts/register-local-opf.mjs build.mjs after <opf-pptx>): writes decks/<id>-<side>.pptx and facts-<side>.json
//   node build.mjs manifest <core before sha> <core after sha>      merges the two fact files into manifest.json
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {strFromU8, unzipSync} from 'fflate';

const OPTIONS = {seed: 1, timestamp: '2026-10-05T00:00:00Z', zipDate: '2026-10-05T00:00:00Z'};
const am = 'አማርኛ ቋንቋ እጅግ ጥሩ ነው።', hy = 'Հայերեն լեզու', ka = 'ქართული ენა';
const inline = (family, slot = 'complexScript') => ({major: family, minor: family, [slot]: {major: family, minor: family}});
const ja = 'ひらがなとカタカナと漢字';
const scheme = family => ({major: family, minor: family, languageFamily: 'cs', languages: ['Amharic']});
const deck = (name, language, text, design) => ({name, language, ...(design ? {design: {fontScheme: design}} : {}), slides: [{title: text, text}, {title: text, text: `${text} ${text}`}]});
// `script`: the script entry the theme names; `changed`: whether the fix changes this deck (false: byte-identical control).
const DECKS = {
  'ethi-amharic-ebrima': {
    title: 'The opf#375 repro: Amharic on an Ebrima cs scheme. Before: Ethi = Nyala and Presentation.Fonts lists Nyala. After: Ebrima only',
    document: deck('Amharic on Ebrima', 'amharic', am, scheme('Ebrima')), script: 'Ethi', text: am, changed: true,
    expect: {fonts: ['Ebrima'], family: 'Ebrima', themeScript: 'Ebrima'},
  },
  'ethi-amharic-ebrima-inline': {
    title: 'The native FF-46 deck scripts-40-amharic-ebrima, built the same way: language am, inline scheme with an explicit complexScript slot. Before: Ethi = Nyala and Presentation.Fonts lists Nyala. After: Ebrima only',
    document: deck('Amharic on Ebrima (inline complexScript)', 'am', am, inline('Ebrima')), script: 'Ethi', text: am, changed: true,
    expect: {fonts: ['Ebrima'], family: 'Ebrima', themeScript: 'Ebrima'},
  },
  'jpan-japanese-msgothic-inline': {
    title: 'Control, byte-identical: the inline eastAsian form (MS Gothic) on a Japanese deck; the Jpan entry already follows the slot',
    document: deck('Japanese on MS Gothic (inline eastAsian)', 'ja', ja, inline('MS Gothic', 'eastAsian')), script: 'Jpan', text: ja, changed: false,
    expect: {fonts: ['MS Gothic'], family: 'MS Gothic', themeScript: 'MS Gothic'},
  },
  'ethi-amharic-noto': {
    title: 'Amharic on the catalog scheme noto-sans-ethiopic (before: Ethi = Nyala)',
    document: deck('Amharic on Noto Sans Ethiopic', 'amharic', am, 'noto-sans-ethiopic'), script: 'Ethi', text: am, changed: true,
    expect: {fonts: ['Noto Sans Ethiopic'], family: 'Noto Sans Ethiopic', themeScript: 'Noto Sans Ethiopic'},
  },
  'armn-armenian-noto': {
    title: 'Armenian on the catalog scheme noto-sans-armenian (before: Armn = Sylfaen)',
    document: deck('Armenian on Noto Sans Armenian', 'armenian', hy, 'noto-sans-armenian'), script: 'Armn', text: hy, changed: true,
    expect: {fonts: ['Noto Sans Armenian'], family: 'Noto Sans Armenian', themeScript: 'Noto Sans Armenian'},
  },
  'geor-georgian-noto': {
    title: 'Georgian on the catalog scheme noto-sans-georgian (before: Geor = Sylfaen)',
    document: deck('Georgian on Noto Sans Georgian', 'georgian', ka, 'noto-sans-georgian'), script: 'Geor', text: ka, changed: true,
    expect: {fonts: ['Noto Sans Georgian'], family: 'Noto Sans Georgian', themeScript: 'Noto Sans Georgian'},
  },
  'ethi-amharic-default': {
    title: 'Control, byte-identical before and after: Amharic on the default scheme (the language names Nyala for Ethi)',
    document: deck('Amharic default', 'amharic', am), script: 'Ethi', text: am, changed: false,
    expect: {fonts: ['Aptos', 'Aptos Display', 'Nyala'], themeScript: 'Nyala'},
  },
  'ethi-amharic-nyala': {
    title: 'Control, byte-identical: Amharic on the Nyala cs scheme',
    document: deck('Amharic on Nyala', 'amharic', am, 'nyala'), script: 'Ethi', text: am, changed: false,
    expect: {fonts: ['Nyala'], family: 'Nyala', themeScript: 'Nyala'},
  },
  'armn-armenian-sylfaen': {
    title: 'Control, byte-identical: Armenian on the Sylfaen cs scheme',
    document: deck('Armenian on Sylfaen', 'armenian', hy, 'sylfaen'), script: 'Armn', text: hy, changed: false,
    expect: {fonts: ['Sylfaen'], family: 'Sylfaen', themeScript: 'Sylfaen'},
  },
  'geor-georgian-sylfaen': {
    title: 'Control, byte-identical: Georgian on the Sylfaen cs scheme',
    document: deck('Georgian on Sylfaen', 'georgian', ka, 'sylfaen'), script: 'Geor', text: ka, changed: false,
    expect: {fonts: ['Sylfaen'], family: 'Sylfaen', themeScript: 'Sylfaen'},
  },
  'latin-english-control': {
    title: 'Control, byte-identical: English on the default scheme (no script supplement)',
    document: deck('English default', 'english-us', 'Hello world'), script: 'Ethi', text: 'Hello world', changed: false,
    expect: {fonts: ['Aptos', 'Aptos Display']},
  },
};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const themeScript = (xml, tag, script) => new RegExp(`<a:${tag}>[\\s\\S]*?<a:font script="${script}" typeface="([^"]*)"/>[\\s\\S]*?</a:${tag}>`).exec(xml)?.[1] ?? null;
const here = new URL('.', import.meta.url);
const [command, ...rest] = process.argv.slice(2);

if (command === 'before' || command === 'after') {
  const {toPptx} = await import(pathToFileURL(path.join(path.resolve(rest[0]), 'dist/index.js')).href);
  const facts = {};
  for (const [id, entry] of Object.entries(DECKS)) {
    const bytes = await toPptx(structuredClone(entry.document), OPTIONS);
    await writeFile(new URL(`decks/${id}-${command}.pptx`, here), bytes);
    const theme = strFromU8(unzipSync(bytes)['ppt/theme/theme1.xml']);
    facts[id] = {file: `${id}-${command}.pptx`, bytes: bytes.byteLength, sha256: sha(bytes), themeScript: {major: themeScript(theme, 'majorFont', entry.script), minor: themeScript(theme, 'minorFont', entry.script)}};
  }
  await writeFile(new URL(`facts-${command}.json`, here), `${JSON.stringify(facts, null, 2)}\n`);
} else if (command === 'manifest') {
  const [beforeSha, afterSha] = rest;
  const [before, after] = await Promise.all(['before', 'after'].map(async side => JSON.parse(await readFile(new URL(`facts-${side}.json`, here), 'utf8'))));
  const manifest = {
    item: 'FF-46 theme script supplement of a latin-slot script names the chosen scheme family (opf#375)',
    builds: {before: {core: `opf main ${beforeSha} (0.12.2)`}, after: {core: `opf codex/ff-46-ethiopic-supplement ${afterSha}`}, opfPptx: 'main 7c93a1b (0.12.3); the fix is in core, opf-pptx writes the supplement as core resolves it'},
    options: OPTIONS,
    pass: [
      'Every deck opens without a repair prompt and reads stage: done.',
      'Presentation.Fonts lists no empty name and nothing outside expect.fonts (the families the deck chose). The accepted RR-05 reading is that PowerPoint may omit theme-only script families.',
      'after decks: the runs holding the script sample read expect.family in Name; the theme file names expect.themeScript for the script entry (file fact).',
      'before decks marked changed: expected to FAIL (BASELINE): Presentation.Fonts lists the language default (Nyala or Sylfaen) beside the chosen family. This is the opf#375 defect kept as evidence.',
      'control decks (changed: false): before and after are byte-identical (same sha256) and read the same.',
    ],
    decks: {},
  };
  for (const [id, entry] of Object.entries(DECKS)) {
    if (!entry.changed && before[id].sha256 !== after[id].sha256) throw new Error(`${id}: control differs`);
    if (entry.changed && before[id].sha256 === after[id].sha256) throw new Error(`${id}: fix did not change the deck`);
    manifest.decks[id] = {title: entry.title, document: entry.document, script: entry.script, text: entry.text, changed: entry.changed, expect: entry.expect, files: {before: before[id], after: after[id]}};
  }
  await writeFile(new URL('manifest.json', here), `${JSON.stringify(manifest, null, 2)}\n`);
  for (const [id, deck] of Object.entries(manifest.decks)) console.log(id, deck.changed ? 'changed' : 'identical', `before ${JSON.stringify(deck.files.before.themeScript)} after ${JSON.stringify(deck.files.after.themeScript)}`);
}
