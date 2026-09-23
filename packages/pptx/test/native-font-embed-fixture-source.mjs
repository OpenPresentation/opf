import {strFromU8, strToU8, unzipSync, zipSync} from 'fflate';

// Carlito-only source for the bounded font-embed harness. The fonts come only from public OPF input
// (design.fontScheme major/minor), so the exporter writes Carlito into the theme majorFont/minorFont latin
// slots and into every explicit slide run. Shape names and edit spans stay identical to Gate E.
export function carlitoOnlySource() {
  return {design: {fontScheme: {major: 'Carlito', minor: 'Carlito'}}, slides: [{title: 'Plain control', text: 'Current content'}]};
}

// Harness-owned transform. The vendored PptxGenJS slide master hard-codes Arial as the bullet font on
// all nine bodyStyle levels and OPF input cannot change it. PowerPoint's Presentation.Fonts may report
// master bullet fonts, which would make the fail-closed Carlito allowlist reject the fixture before SaveAs.
// This is the only byte change; it is opt-in, counted, and recorded in generation.json with the raw
// exporter output kept beside the fixture.
export const MASTER_BULLET_FONT_TRANSFORM = Object.freeze({
  id: 'master-bullet-font-carlito',
  owner: 'test/native-font-edit-fixture.mjs (harness-owned; not exporter output)',
  part: 'ppt/slideMasters/slideMaster1.xml',
  from: '<a:buFont typeface="Arial" pitchFamily="34" charset="0"/>',
  to: '<a:buFont typeface="Carlito" pitchFamily="34" charset="0"/>',
  expectedCount: 9,
  reason: 'Vendored PptxGenJS master bodyStyle hard-codes Arial bullets; OPF input cannot express the master bullet font, and Presentation.Fonts may report it.',
});
const FIXED_ZIP_MTIME = new Date('2026-01-01T00:00:00Z');

export function applyMasterBulletFontTransform(pptxBytes) {
  const entries = unzipSync(new Uint8Array(pptxBytes));
  const {part, from, to, expectedCount} = MASTER_BULLET_FONT_TRANSFORM;
  if (!entries[part]) throw new Error(`Transform part is missing: ${part}`);
  const before = strFromU8(entries[part]);
  const count = before.split(from).length - 1;
  if (count !== expectedCount) throw new Error(`Expected ${expectedCount} Arial master bullet fonts, found ${count}`);
  const after = before.split(from).join(to);
  if (/typeface="Arial"/.test(after)) throw new Error('Arial remains in the slide master after the bullet-font transform');
  const rebuilt = {};
  for (const [name, bytes] of Object.entries(entries)) rebuilt[name] = name === part ? strToU8(after) : bytes;
  const bytes = Buffer.from(zipSync(rebuilt, {level: 6, mtime: FIXED_ZIP_MTIME}));
  const reread = unzipSync(new Uint8Array(bytes)), names = Object.keys(entries);
  if (Object.keys(reread).join('\n') !== names.join('\n')) throw new Error('Bullet-font transform changed the package entry list or order');
  for (const name of names) if (name !== part && Buffer.compare(Buffer.from(reread[name]), Buffer.from(entries[name])) !== 0) throw new Error(`Bullet-font transform changed an unrelated part: ${name}`);
  return {bytes, replacements: count};
}

const TAG = /<([A-Za-z][\w.-]*:[\w.-]+|[\w.-]+)\b([^>]*?)\btypeface="([^"]*)"([^>]*)>/g;
const SCRIPT = /\bscript="([^"]*)"/;
const THEME_REFERENCE = /^\+m[jn]-(?:lt|ea|cs)$/;

// Every typeface attribute in every XML part, grouped by element/script/typeface with the parts that use it.
export function typefaceInventory(pptxBytes) {
  const entries = unzipSync(new Uint8Array(pptxBytes)), rows = new Map();
  for (const [name, bytes] of Object.entries(entries)) {
    if (!/\.(xml|rels)$/.test(name)) continue;
    const text = strFromU8(bytes);
    for (const match of text.matchAll(TAG)) {
      const element = match[1], typeface = match[3], script = SCRIPT.exec(match[2] + match[4])?.[1] ?? null;
      const key = JSON.stringify([element, script, typeface]);
      if (!rows.has(key)) rows.set(key, {element, script, typeface, occurrences: 0, parts: new Set()});
      const row = rows.get(key); row.occurrences++; row.parts.add(name);
    }
  }
  return [...rows.values()].map(row => ({...row, parts: [...row.parts].sort()}))
    .sort((a, b) => a.element.localeCompare(b.element) || String(a.script).localeCompare(String(b.script)) || a.typeface.localeCompare(b.typeface));
}

export function themeFontSlots(pptxBytes) {
  const theme = strFromU8(unzipSync(new Uint8Array(pptxBytes))['ppt/theme/theme1.xml'] ?? new Uint8Array());
  const slot = name => {
    const block = theme.match(new RegExp(`<a:${name}>([\\s\\S]*?)</a:${name}>`))?.[1] ?? '';
    const read = element => block.match(new RegExp(`<a:${element} typeface="([^"]*)"`))?.[1] ?? null;
    return {latin: read('latin'), ea: read('ea'), cs: read('cs')};
  };
  return {majorFont: slot('majorFont'), minorFont: slot('minorFont')};
}

// docProps/app.xml "Fonts Used" is static PptxGenJS metadata (Arial, Calibri) that PowerPoint rewrites on
// save. It is recorded as a residual, not transformed, because it is not a text or theme font slot.
export function declaredFontsUsed(pptxBytes) {
  const app = strFromU8(unzipSync(new Uint8Array(pptxBytes))['docProps/app.xml'] ?? new Uint8Array());
  const count = Number(app.match(/<vt:lpstr>Fonts Used<\/vt:lpstr><\/vt:variant>\s*<vt:variant><vt:i4>(\d+)<\/vt:i4>/)?.[1] ?? 0);
  const titles = [...(app.match(/<TitlesOfParts>([\s\S]*?)<\/TitlesOfParts>/)?.[1] ?? '').matchAll(/<vt:lpstr>([^<]*)<\/vt:lpstr>/g)].map(match => match[1]);
  return titles.slice(0, count);
}

// latin/ea/cs/sym (run, endParaRPr, master, layout, notes and theme text slots) must be Carlito, empty,
// or a theme reference. a:font script supplements are listed as residuals because they apply only to
// the named non-Latin scripts. a:buFont must be Carlito only when the harness transform was applied.
export function carlitoOnlyTypefaceFailures(inventory, themeSlots, {requireCarlitoBullets}) {
  const failures = [], residual = [];
  for (const row of inventory) {
    const ok = row.typeface === 'Carlito' || THEME_REFERENCE.test(row.typeface);
    if (['a:latin', 'a:ea', 'a:cs', 'a:sym'].includes(row.element)) {
      if (!ok && !(row.typeface === '' && row.element !== 'a:latin')) failures.push({code: 'non-carlito-text-typeface', row});
    } else if (row.element === 'a:buFont') {
      if (!ok) (requireCarlitoBullets ? failures : residual).push({code: 'non-carlito-bullet-font', row});
    } else if (row.element === 'a:font' && row.script) {
      residual.push({code: 'theme-script-supplement', row});
    } else if (!ok) failures.push({code: 'unexpected-typeface-element', row});
  }
  for (const slotName of ['majorFont', 'minorFont']) {
    if (themeSlots?.[slotName]?.latin !== 'Carlito') failures.push({code: 'theme-latin-not-carlito', slot: slotName, typeface: themeSlots?.[slotName]?.latin ?? null});
  }
  return {failures, residual};
}
