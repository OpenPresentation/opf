// RR-17 (FF-44, FF-45): the per-family fixture model shared by the Node and browser script-family host tests. For every open script,
// emoji and math family the manifest pins (the 35 faces of the `scripts` pack: Noto Sans and the Noto script families, Noto Color Emoji
// and Noto Emoji, Noto Sans Math and STIX Two Math), it says which package holds the face, which files a host serves for it and which
// text exercises it: the FF-44 script corpora samples (test/fixtures/script-corpora.json) that the family's own faces cover completely,
// and, for the emoji and math faces, the FF-45 sequences and notation. A sample the face does not cover completely is left out, so
// nothing in a fixture deck needs the glyph-fallback chain: every run must be drawn by the family named.
import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as fontkit from 'fontkit';
import {BUNDLED_FONT_MANIFEST} from '../dist/fonts-node.js';
import {fontkitRun, loadCorpora} from '../scripts/script-corpora.mjs';

export const root = fileURLToPath(new URL('../', import.meta.url));
/** Scripts of the symbol faces (Noto Sans Symbols, Symbols 2): code-table special route, not a family of this fixture. */
const SYMBOL_ONLY = ['Zsym'];
export const SAMPLES_PER_FAMILY = 3;
export const PROBE_SIZE = 40;

const EMOJI = {
  rocket: '\u{1F680}', family: '\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}', flag: '\u{1F1E9}\u{1F1EA}', thumbsMedium: '\u{1F44D}\u{1F3FD}',
  keycap: '1️⃣', heartVS16: '❤️', scotland: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}',
  womanTechnologist: '\u{1F469}\u{1F3FE}‍\u{1F4BB}', rainbowFlag: '\u{1F3F3}️‍\u{1F308}',
};
/** FF-45 samples: emoji sequences (one glyph each) and mathematical notation. The corpus has no group for them. */
const SPECIAL_SAMPLES = {
  Zsye: [
    {id: 'emoji-pictographs', text: `${EMOJI.rocket}${EMOJI.family}${EMOJI.flag}${EMOJI.thumbsMedium}`},
    {id: 'emoji-sequences', text: `${EMOJI.keycap}${EMOJI.heartVS16}${EMOJI.scotland}${EMOJI.womanTechnologist}${EMOJI.rainbowFlag}`},
  ],
  Zmth: [
    {id: 'math-operators', text: '∑∫√≤∞≠≈'},
    {id: 'math-alphanumerics', text: '\u{1D44E}\u{1D44F}\u{1D450}ℝℕℤαβγ'},
    {id: 'math-brackets', text: '⟨⟩⌈⌉⌊⌋〈〉'},
  ],
};

const slash = value => value.split(String.fromCharCode(92)).join('/');
export const shortName = name => name.replace('@expo-google-fonts/', '');
const ignorable = /^\p{Default_Ignorable_Code_Point}$/u;
/** CJK punctuation, fullwidth and halfwidth forms and curly quotes: lines with them are not gated on Linux Chromium (recorded, as in script-corpora-browser.mjs). */
export const FULLWIDTH = /[\u3000-\u303F\uFF00-\uFFEF\u2018-\u201D]/;

/** Bold requests take the nearest weight the family has (ties to the lighter), as the registry resolves them. */
export function expectedWeight(entry, bold) {
  const target = bold ? 700 : 400;
  return [...entry.weights].sort((a, b) => Math.abs(a - target) - Math.abs(b - target) || a - b)[0];
}

/** A sample is usable for a family when every one of its faces has a glyph for every character of it. */
export const covers = (fonts, text) => fonts.every(font => [...text].every(character => ignorable.test(character) || font.hasGlyphForCodePoint(character.codePointAt(0))));

/**
 * The families the fixture covers, in manifest order: one row per family of the `scripts` pack (the symbol-only faces excluded) with its
 * package, the faces and their files (root-relative and as a host serves them from the pack directory), the parsed fonts and the
 * samples. `root` is where the pinned packages are installed.
 */
export async function scriptFamilies({packagesRoot = root, limits = true} = {}) {
  const corpora = await loadCorpora();
  const limited = new Set(corpora.knownShapingLimits.flatMap(limit => Object.keys(limit.samples).map(id => `${limit.family}|${id}`)));
  const rows = [];
  for (const pkg of BUNDLED_FONT_MANIFEST.packages) {
    if (pkg.pack !== 'scripts' || pkg.scripts.every(script => SYMBOL_ONLY.includes(script))) continue;
    const family = pkg.faces[0].family;
    const faces = pkg.faces.map(face => ({...face, package: pkg.name, served: `${shortName(pkg.name)}/${face.file}`, file: path.join(packagesRoot, 'node_modules', pkg.name, face.file)}));
    const fonts = await Promise.all(faces.map(async face => fontkit.create(new Uint8Array(await readFile(face.file)))));
    const upright = faces.filter(face => !face.italic);
    const scripts = pkg.scripts.filter(script => !SYMBOL_ONLY.includes(script));
    const candidates = [];
    for (const script of scripts) {
      const group = corpora.groups.find(item => item.script === script);
      if (group) for (const sample of group.samples) candidates.push({id: sample.id, script, text: sample.text, lang: sample.lang, rtl: group.direction === 'rtl', language: group.languages.find(tag => tag.split('-')[0] === sample.lang.split('-')[0]) ?? group.languages[0] ?? sample.lang, limited: limited.has(`${family}|${sample.id}`)});
      for (const sample of SPECIAL_SAMPLES[script] ?? []) candidates.push({...sample, script, lang: null, rtl: false, language: null, limited: false});
    }
    // Samples every face of the family covers completely; the recorded fontkit limits come last (they stay bounded, never excluded silently).
    const usable = candidates.filter(sample => covers(fonts, sample.text));
    // Samples without fullwidth punctuation come first: Linux Chromium paints such lines differently from Edge and macOS Chromium (see
    // test/script-corpora-browser.mjs), so the browser fixture does not gate their advance there.
    const rank = sample => (sample.limited ? 2 : 0) + (FULLWIDTH.test(sample.text) ? 1 : 0);
    const preferred = [...usable].sort((a, b) => rank(a) - rank(b));
    // Spread the picks over the scripts a family serves (Noto Sans: Cyrillic, Greek and Latin).
    const picked = [];
    for (let round = 0; picked.length < SAMPLES_PER_FAMILY; round++) {
      const before = picked.length;
      for (const script of scripts) {
        const next = preferred.filter(sample => sample.script === script)[round];
        if (next && picked.length < SAMPLES_PER_FAMILY) picked.push(next);
      }
      if (picked.length === before) break;
    }
    rows.push({
      family, package: pkg.name, packageShort: shortName(pkg.name), version: pkg.version, scripts, color: pkg.color ?? null,
      faces, fonts, weights: [...new Set(upright.map(face => face.weight))].sort((a, b) => a - b), samples: picked, candidates: candidates.length, usable: usable.length,
      files: faces.map(face => face.served),
    });
  }
  return rows;
}

export async function packageBytes(entry) {
  return (await Promise.all(entry.faces.map(async face => (await stat(face.file)).size))).reduce((a, b) => a + b, 0);
}

/** The fontkit advance of `text` at `size` px in one of the family's fonts, shaped as the renderer shapes it (retries and language included). */
export function directAdvance(font, text, size, lang) {
  const shaped = fontkitRun(font, text, lang ?? undefined);
  if (!shaped.run) throw new Error(`fontkit cannot shape ${JSON.stringify(text)}: ${shaped.error}`);
  return shaped.run.positions.reduce((sum, position) => sum + position.xAdvance, 0) / font.unitsPerEm * size;
}

/** A deck that draws `sample` as the title (heading), then regular and bold as the body, all in `entry.family` (the Latin, East Asian and complex-script slots alike). */
export function scriptDeck(entry, sample) {
  return {
    $schema: 'https://openpresentation.org/schema/opf/v1',
    name: `Script fixture ${entry.family} ${sample.id}`,
    ...(sample.language ? {language: sample.language} : {}),
    design: {fontScheme: {id: 'x-script-fixture', name: entry.family, major: entry.family, minor: entry.family, eastAsian: {major: entry.family, minor: entry.family}, complexScript: {major: entry.family, minor: entry.family}}},
    slides: [{id: 'a', title: sample.text, text: [{text: sample.text}, {text: sample.text, bold: true}]}],
  };
}

/** Every drawn run of an SVG: family, weight, slope, pinned length, size and the content without bidirectional isolate marks. */
export function drawnRuns(svg) {
  const runs = [];
  const attributeOf = (attributes, name) => new RegExp(`\\s${name}="([^"]*)"`).exec(attributes)?.[1];
  const unquote = value => value?.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
  const decode = value => value.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16))).replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number))).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  for (const match of svg.matchAll(/<text\b([^>]*)>(.*?)<\/text>/gs)) {
    const [, attributes, content] = match;
    const owner = {family: unquote(attributeOf(attributes, 'font-family')), weight: Number(attributeOf(attributes, 'font-weight') ?? 400), italic: attributeOf(attributes, 'font-style') === 'italic', size: Number(attributeOf(attributes, 'font-size')), length: attributeOf(attributes, 'textLength')};
    if (!content.includes('<tspan')) { runs.push({...owner, length: owner.length === undefined ? NaN : Number(owner.length), text: decode(content)}); continue; }
    for (const span of content.matchAll(/<tspan\b([^>]*)>([^<]*)<\/tspan>/g)) {
      const [, own, text] = span;
      runs.push({
        family: unquote(attributeOf(own, 'font-family')) ?? owner.family, weight: Number(attributeOf(own, 'font-weight') ?? owner.weight), italic: (attributeOf(own, 'font-style') ?? (owner.italic ? 'italic' : 'normal')) === 'italic',
        size: Number(attributeOf(own, 'font-size') ?? owner.size), length: attributeOf(own, 'textLength') === undefined ? NaN : Number(attributeOf(own, 'textLength')), text: decode(text),
      });
    }
  }
  const marks = /[⁦-⁩‎‏‪-‮]/g;
  return runs.map(run => ({...run, text: run.text.replace(marks, '')})).filter(run => run.text.trim());
}

/**
 * Findings: a family that fails a host check keeps failing it, strictly, and is recorded here with the check that fails and why. The
 * fixtures assert that the failure is exactly this one (so a fix is noticed and the entry removed, and a different failure is not
 * hidden); the family is left out of that host's passing families and the evidence file lists the finding. Nothing here relaxes a check.
 */
export const FINDINGS = {
  'Noto Emoji': {
    browser: {
      match: /emoji-sequences: .* advance [\d.]+ differs from accepted [\d.]+/,
      reason: 'Chromium does not draw emoji-presentation sequences (VS16: the keycap 1\uFE0F\u20E3, the red heart \u2764\uFE0F, the rainbow flag) with the monochrome Noto Emoji: each falls to another face at a 1.000 em advance, where the face and the renderer give 1.2695 em. The pictograph, flag, skin-tone, ZWJ and tag sequences draw in Noto Emoji at its own advance. The colour face (Noto Color Emoji) draws all of them. Noto Emoji is the raster stand-in and an alternate of Segoe UI Emoji, never the browser face of a Segoe UI Emoji run (the planner gives emoji runs to Noto Color Emoji).',
    },
  },
};

/** Every failure must be a recorded finding of this host, and every recorded finding of the host must have failed. */
export function assertFindings(found, host, families) {
  for (const item of found) {
    const expected = FINDINGS[item.family]?.[host];
    if (!expected) throw new assertError(`${item.family} (${host}): ${item.message}`);
    if (!expected.match.test(item.message)) throw new assertError(`${item.family} (${host}) fails differently from its recorded finding: ${item.message}`);
    item.reason = expected.reason;
  }
  for (const [family, hosts] of Object.entries(FINDINGS)) {
    if (hosts[host] && families.includes(family) && !found.some(item => item.family === family)) throw new assertError(`${family} (${host}) passes now: remove its finding from FINDINGS`);
  }
}
class assertError extends Error { constructor(message) { super(message); this.name = 'AssertionError'; } }
