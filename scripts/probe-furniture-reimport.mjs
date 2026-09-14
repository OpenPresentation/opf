// An acceptance probe: historical loss is a failure, not the expected result.
// Run after building and linking the four sibling source packages on Node 24.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {validatePresentation} from '../packages/javascript/dist/index.js';
import {toPptx, fromPptx} from '../../opf-pptx/dist/index.js';
import {prepareNodeFonts} from '../../opf-render/dist/fonts-node.js';

const require = createRequire(new URL('../../opf-pptx/package.json', import.meta.url));
const {unzipSync, zipSync} = require('fflate');
const output = path.resolve(process.argv[2] ?? 'artifacts/furniture-reimport');
await mkdir(output, {recursive: true});
const {options} = await prepareNodeFonts();
const hash = value => createHash('sha256').update(value).digest('hex');
const effective = (deck, index, kind) => deck.slides[index].design?.[kind] ?? deck.design?.[kind];
const literal = '  Header\twords\r\nsecond  \r\n';
const image = {
  src: `data:image/png;base64,${(await readFile(new URL('../../opf-pptx/test/fixtures/images/wide.png', import.meta.url))).toString('base64')}`,
  alt: 'Current native header image',
};
const cases = [
  {
    id: 'literal-and-generated',
    source: {design: {fontScheme: 'roboto', header: {left: {text: literal}, right: {section: true}}, footer: {left: {date: ' 2026-09-14 '}, right: {slideNumber: true}}}, slides: [{title: 'First', section: 'Overview', text: 'First body'}, {title: 'Second', section: 'Details', text: 'Second body'}]},
    checks: deck => ({
      literalWhitespace: [0, 1].every(index => effective(deck, index, 'header')?.left?.text === literal),
      literalDate: [0, 1].every(index => effective(deck, index, 'footer')?.left?.date === ' 2026-09-14 '),
      generatedNumberIntent: [0, 1].every(index => effective(deck, index, 'footer')?.right?.slideNumber === true),
      sectionIntent: [0, 1].every(index => effective(deck, index, 'header')?.right?.section === true),
      currentSectionMetadata: deck.slides[0].section === 'Overview' && deck.slides[1].section === 'Details',
    }),
  },
  {
    id: 'false-and-empty',
    source: {design: {fontScheme: 'roboto', header: {left: {text: 'Inherited'}}}, slides: [{title: 'Disabled', text: 'Body', design: {header: false}}, {title: 'Empty', text: 'Body', design: {header: {}}}, {title: 'Inherited', text: 'Body'}]},
    checks: deck => ({
      explicitFalse: deck.slides[0].design?.header === false,
      explicitEmpty: JSON.stringify(deck.slides[1].design?.header) === '{}',
      inheritedLiteral: effective(deck, 2, 'header')?.left?.text === 'Inherited',
    }),
  },
  {
    id: 'image',
    source: {design: {fontScheme: 'roboto', header: {left: {image}}}, slides: [{title: 'Image', text: 'Body'}]},
    checks: deck => ({
      imageRole: effective(deck, 0, 'header')?.left?.image?.src === image.src,
      imageAlt: effective(deck, 0, 'header')?.left?.image?.alt === image.alt,
    }),
  },
  {
    id: 'current-native-edit',
    source: {design: {fontScheme: 'roboto', header: {left: {text: 'Original header'}}}, slides: [{title: 'Current native text', text: 'Body'}]},
    edit: bytes => {
      const entries = unzipSync(bytes);
      const xml = new TextDecoder().decode(entries['ppt/slides/slide1.xml']);
      assert.ok(xml.includes('<a:t>Original header</a:t>'));
      entries['ppt/slides/slide1.xml'] = new TextEncoder().encode(xml.replace('<a:t>Original header</a:t>', '<a:t>Edited header</a:t>'));
      return zipSync(entries);
    },
    checks: deck => ({
      currentTextRetained: JSON.stringify(deck).includes('Edited header'),
      staleTextAbsent: !JSON.stringify(deck).includes('Original header'),
      furnitureRoleRetained: effective(deck, 0, 'header')?.left?.text === 'Edited header',
    }),
  },
  {
    id: 'ordinary-text-control',
    source: {design: {fontScheme: 'roboto'}, slides: [{title: 'Ordinary heading', text: 'Ordinary body'}]},
    checks: deck => ({
      noInventedHeader: effective(deck, 0, 'header') === undefined,
      noInventedFooter: effective(deck, 0, 'footer') === undefined,
      bodyRetained: JSON.stringify(deck).includes('Ordinary body'),
    }),
  },
];
const results = [];
for (const fixture of cases) {
  assert.equal(validatePresentation(fixture.source).valid, true, fixture.id);
  const sourceBefore = JSON.stringify(fixture.source);
  const original = await toPptx(fixture.source, {...options, strictAssets: true});
  const bytes = fixture.edit ? fixture.edit(original) : original;
  const diagnostics = [];
  const imported = await fromPptx(bytes, {onDiagnostic: issue => diagnostics.push(issue)});
  assert.equal(JSON.stringify(fixture.source), sourceBefore, `${fixture.id}: export mutated source`);
  assert.equal(validatePresentation(imported).valid, true, fixture.id);
  assert.equal(imported.slides.length, fixture.source.slides.length, fixture.id);
  const checks = fixture.checks(imported);
  const failures = Object.keys(checks).filter(key => !checks[key]);
  const record = {id: fixture.id, source: fixture.source, imported, checks, failures, diagnostics, pptxSha256: hash(bytes)};
  await writeFile(path.join(output, `${fixture.id}.json`), JSON.stringify(record, null, 2) + '\n');
  await writeFile(path.join(output, `${fixture.id}.pptx`), bytes);
  results.push({id: fixture.id, checks, failures, pptxSha256: hash(bytes)});
}
const report = {node: process.version, verifierSha256: hash(await readFile(new URL(import.meta.url))), results,
  scope: 'Source export/reimport acceptance probe. XML edits simulate current native content. No native Office execution, visual approval or installed-package acceptance.'};
await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const failures = results.flatMap(result => result.failures.map(check => `${result.id}: ${check}`));
console.log(JSON.stringify({cases: results.length, failedChecks: failures}, null, 2));
if (failures.length) process.exitCode = 1;
