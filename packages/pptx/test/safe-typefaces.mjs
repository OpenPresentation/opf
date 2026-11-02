// LH-28: `typefaces: 'safe'` writes each Latin text family as an Office-safe family (on every Windows and macOS machine, measured
// exactly through its metric open twin) and lays the text out with it, so the file's line breaks are the ones any viewer draws.
// The default keeps the selected families, and typefacesNotOfficeSafe() names the ones a viewer may substitute.
import assert from 'node:assert/strict';
import {strFromU8, unzipSync} from 'fflate';
import {FONT_POLICY} from '@openpresentation/opf';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
import {toPptx, fromPptx} from './helpers/default-catalog.mjs';
import {OFFICE_SAFE_TYPEFACES, officeSafeTypeface, typefacesNotOfficeSafe} from '../dist/index.js';
import {SAFE_TYPEFACE_FOR_CLASS, isLatinTextFamily, typefaceClasses, writeSafeTypefaces} from '../dist/safe-typefaces.js';

let checks = 0;

// The safe set is the policy's: shipped with Windows and macOS, with a metric-compatible open replacement.
{
  const expected = FONT_POLICY.families.filter(row => row.availability.includes('windows') && row.availability.includes('macos') && row.replacement?.compatibility === 'metric').map(row => row.family).sort();
  assert.deepEqual([...OFFICE_SAFE_TYPEFACES], expected);
  assert.deepEqual([...OFFICE_SAFE_TYPEFACES], ['Arial', 'Courier New', 'Georgia', 'Times New Roman']);
  for (const family of Object.values(SAFE_TYPEFACE_FOR_CLASS)) assert.ok(OFFICE_SAFE_TYPEFACES.includes(family), `${family} is Office-safe`);
  checks++;
}

// The mapping: safe families stay, metric twins become their safe family, the rest go by design class.
{
  const classes = typefaceClasses([{type: 'serif', major: 'Lora', minor: 'Lora'}, {type: 'sans-serif', major: 'Montserrat', minor: 'Source Sans 3', code: 'JetBrains Mono'}]);
  const cases = [
    ['Arial', 'Arial'], ['times new roman', 'Times New Roman'],
    ['Arimo', 'Arial'], ['Liberation Sans', 'Arial'], ['Tinos', 'Times New Roman'], ['Cousine', 'Courier New'], ['Gelasio', 'Georgia'],
    ['Aptos', 'Arial'], ['Calibri', 'Arial'], ['Lora', 'Georgia'], ['Montserrat', 'Arial'], ['JetBrains Mono', 'Courier New'], ['Roboto Mono', 'Courier New'],
    ['Brand Sans', 'Arial'],
    // Not Latin text: symbol encodings, emoji, math, script faces and theme tokens keep their names.
    ['Wingdings', 'Wingdings'], ['Symbol', 'Symbol'], ['Segoe UI Emoji', 'Segoe UI Emoji'], ['Cambria Math', 'Cambria Math'],
    ['Noto Sans JP', 'Noto Sans JP'], ['Microsoft YaHei', 'Microsoft YaHei'], ['Noto Naskh Arabic', 'Noto Naskh Arabic'], ['+mn-lt', '+mn-lt'],
  ];
  for (const [family, safe] of cases) assert.equal(officeSafeTypeface(family, classes), safe, family);
  assert.equal(isLatinTextFamily('Noto Sans'), true, 'Noto Sans itself is a Latin text family');
  checks++;
}

// The XML pass: latin and bullet fonts; an East Asian slot only where it repeats the Latin family as a fallback.
{
  const safe = family => officeSafeTypeface(family);
  const run = '<a:rPr lang="en-US"><a:latin typeface="Aptos" panose="020B0004020202020204" pitchFamily="34" charset="0"/><a:ea typeface="Aptos"/><a:cs typeface="Noto Naskh Arabic"/></a:rPr>';
  assert.equal(writeSafeTypefaces(run, safe, {latinFallback: {ea: true, cs: true}}),
    '<a:rPr lang="en-US"><a:latin typeface="Arial" pitchFamily="34" charset="0"/><a:ea typeface="Arial"/><a:cs typeface="Noto Naskh Arabic"/></a:rPr>');
  assert.equal(writeSafeTypefaces(run, safe), '<a:rPr lang="en-US"><a:latin typeface="Arial" pitchFamily="34" charset="0"/><a:ea typeface="Aptos"/><a:cs typeface="Noto Naskh Arabic"/></a:rPr>', 'a chosen East Asian font stays');
  assert.equal(writeSafeTypefaces('<a:pPr><a:buFont typeface="Wingdings"/><a:buChar char="§"/></a:pPr>', safe), '<a:pPr><a:buFont typeface="Wingdings"/><a:buChar char="§"/></a:pPr>');
  checks++;
}

const fonts = await loadFonts({pack: 'office', substitutionPolicy: 'visual'});
const text = 'Quarterly revenue grew in every region while operating costs held flat, which lifted the margin by four points and funded the new platform team without any additional borrowing this year.';
const deck = fontScheme => ({name: 'Safe fonts', ...(fontScheme ? {design: {fontScheme}} : {}), slides: [
  {title: 'Margins widened across all regions this quarter', text, notes: 'Notes stay.'},
  {title: 'Code', bullets: ['Plain', [{text: 'npm test', code: true}, ' and a ', {text: 'Montserrat run', fontFamily: 'Montserrat'}]]},
]});
const exported = async (document, options = {}) => {
  const diagnostics = [];
  const bytes = await toPptx(document, {fonts, onDiagnostic: diagnostic => diagnostics.push(diagnostic), ...options});
  const entries = unzipSync(bytes);
  const lines = strFromU8(entries['ppt/slides/slide1.xml']).match(/<a:t>[^<]*<\/a:t>/g);
  return {bytes, entries, diagnostics, lines};
};

// Safe mode: composition measures the safe family, so the lines are those of the same deck authored in Arial, not the Aptos ones.
{
  const selected = await exported(deck());
  const safe = await exported(deck(), {typefaces: 'safe'});
  const arial = await exported(deck({id: 'arial', heading: 'Arial', body: 'Arial', code: 'Courier New'}));
  assert.deepEqual(safe.lines, arial.lines, 'safe mode breaks lines as an Arial deck does');
  assert.notDeepEqual(safe.lines, selected.lines, 'and not as the Aptos preview does (the fixture wraps differently)');

  assert.deepEqual(typefacesNotOfficeSafe(selected.bytes), ['Aptos', 'Aptos Display', 'Montserrat', 'Roboto Mono']);
  assert.deepEqual(typefacesNotOfficeSafe(safe.bytes), [], 'every Latin typeface of the safe file is Office-safe');
  const app = strFromU8(safe.entries['docProps/app.xml']);
  assert.ok(!/Aptos|Montserrat|Roboto Mono/.test(app), 'Fonts Used names only the safe families');
  assert.match(strFromU8(safe.entries['ppt/theme/theme1.xml']), /<a:majorFont><a:latin typeface="Arial"\/><a:ea typeface="Arial"\/>/, 'the theme fonts, and the East Asian fallback that repeats them');
  assert.deepEqual(safe.diagnostics.filter(item => item.code === 'typeface-replaced').map(item => [item.family, item.replacement]),
    [['Aptos', 'Arial'], ['Aptos Display', 'Arial'], ['Montserrat', 'Arial'], ['Roboto Mono', 'Courier New']]);
  assert.deepEqual(selected.diagnostics.filter(item => item.code === 'typeface-replaced'), [], 'the default replaces nothing');
  assert.match(strFromU8(safe.entries['ppt/notesSlides/notesSlide1.xml']), /Notes stay\./);
  // The file still imports.
  const imported = await fromPptx(safe.bytes);
  assert.equal(imported.slides.length, 2);
  checks++;
}

// A metric twin keeps its line breaks: an Arimo deck is written as Arial and wraps exactly as before.
{
  const arimo = await exported(deck({id: 'arimo', heading: 'Arimo', body: 'Arimo'}), {typefaces: 'safe'});
  const kept = await exported(deck({id: 'arimo', heading: 'Arimo', body: 'Arimo'}));
  assert.deepEqual(arimo.lines, kept.lines);
  assert.match(arimo.diagnostics.find(item => item.family === 'Arimo').message, /same character widths/);
  checks++;
}

await assert.rejects(toPptx(deck(), {typefaces: 'office'}), error => error.code === 'invalid-typefaces-option');
checks++;

console.log(`Safe typeface checks passed (${checks}): the policy's safe set, the mapping, the XML pass, measured line breaks and the report.`);
