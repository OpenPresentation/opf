import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile, realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';

// Candidate-only integration: historical registry fixtures remain immutable.
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(root, process.argv[2] ?? 'artifacts/furniture-fields-browser');
const consumer = path.join(root, 'artifacts/npm/consumer');
const tools = createRequire(new URL('../../opf-render/package.json', import.meta.url));
const installed = createRequire(path.join(consumer, 'package.json'));
const {build} = tools('esbuild'), {chromium} = tools('playwright');
const {unzipSync} = installed('fflate');
const {prepareNodeFonts} = await import(pathToFileURL(installed.resolve('@openpresentation/opf-render/fonts-node')));
const {registry} = await prepareNodeFonts();
const hash = value => createHash('sha256').update(value).digest('hex');
await mkdir(output, {recursive: true});
const manifest = JSON.parse(await readFile(path.join(root, 'artifacts/npm/manifest.json'), 'utf8'));
const artifacts = [];
for (const artifact of manifest.artifacts) {
  const bytes = await readFile(path.join(root, 'artifacts/npm', artifact.file));
  assert.equal(hash(bytes), artifact.sha256, 'Candidate tarball differs from its manifest.');
  artifacts.push({...artifact, actualSha256: hash(bytes)});
}
const contents = `
import {paginatePresentation} from '@openpresentation/opf/pagination';
import {createEditorSession} from '@openpresentation/opf-editor';
import {createCanvasEditor} from '@openpresentation/opf-editor/canvas';
import {loadBrowserFontRegistry} from '@openpresentation/opf-render/fonts-browser';
import {resolvePresentation, renderSvg} from '@openpresentation/opf-render/svg';
import {toPptx, fromPptx} from '@openpresentation/opf-pptx';
window.mount = async ({deck, faces, date, paginate}) => {
  window.canvasEditor?.destroy(); window.fonts?.dispose(); window.unsubscribe?.();
  window.failures = []; window.events = []; window.lastExport = null; window.lastImport = null; window.exportDiagnostics = [];
  window.authored = deck;
  window.fonts = await loadBrowserFontRegistry(faces.map(face => ({...face,
    data: Uint8Array.from(atob(face.dataUrl.split(',')[1]), c => c.charCodeAt(0))
  })), {substitutionPolicy: 'visual', fallbackFamily: 'Roboto'});
  window.renderOptions = {textMeasurement: fonts.textMeasurement, trace: true, date};
  window.pagination = paginate ? paginatePresentation(deck, {...renderOptions, minFontSize: 24}) : null;
  window.editor = createEditorSession(pagination?.presentation ?? deck, {rejectInvalid: true});
  window.unsubscribe = editor.subscribe(event => events.push({type: event.type, patches: event.patches}));
  window.canvasEditor = createCanvasEditor(document.querySelector('#canvas'), {
    editor, renderOptions, onError: error => failures.push(error.message)
  });
  await canvasEditor.ready;
  const action = (id, callback) => document.getElementById(id).onclick = async () => {
    try { await callback(); } catch (error) { failures.push(error.message); }
  };
  action('undo', () => editor.undo()); action('redo', () => editor.redo());
  action('next', () => canvasEditor.setSlide(Math.min(editor.document.slides.length - 1, canvasEditor.slideIndex + 1)));
  action('previous', () => canvasEditor.setSlide(Math.max(0, canvasEditor.slideIndex - 1)));
  action('date', () => {
    const next = {...renderOptions, date: '2026-09-23'};
    if (!canvasEditor.setRenderOptions(next)) throw Error('Host date update was refused.');
    window.renderOptions = next;
  });
  action('export', async () => {
    if (!canvasEditor.commit()) throw Error('Export refused an uncommitted draft.');
    window.lastExport = null; window.lastImport = null; window.exportDiagnostics = [];
    const options = {...renderOptions, seed: 7, timestamp: '2026-01-01T00:00:00Z', zipDate: '2026-01-01T00:00:00Z',
      onDiagnostic: issue => exportDiagnostics.push(issue)};
    window.lastExport = await toPptx(editor.document, options);
    window.lastImport = await fromPptx(lastExport);
  });
};
window.snapshot = async () => {
  await document.fonts.ready;
  const index = canvasEditor.slideIndex, geometry = editor.composeSlide(index, renderOptions);
  const resolved = resolvePresentation(editor.document, renderOptions).slides[index].geometry;
  const svg = document.querySelector('#canvas svg');
  return {index, geometry, resolved, source: editor.document, authored, events,
    canUndo: editor.canUndo, canRedo: editor.canRedo, pagination,
    svg: svg.outerHTML, fields: (geometry.furniture?.parts ?? []).map(part => {
      const group = [...svg.querySelectorAll('[data-opf-source-text]')]
        .find(node => node.getAttribute('data-opf-path') === part.path);
      if (!group) throw Error('Missing actual SVG furniture source: ' + part.path);
      return {path: part.path, selectable: group.hasAttribute('data-canvas-target'),
        lines: [...group.querySelectorAll('text')].map(node => ({text: node.textContent,
          start: Number(node.getAttribute('data-opf-source-start')), end: Number(node.getAttribute('data-opf-source-end'))}))};
    })};
};
window.refusalControls = () => {
  const deck = {design: {footer: {left: {date: true}}}, slides: [{text: 'Body', composition: {overflow: 'error'}}]};
  const before = JSON.stringify(deck), capture = fn => {try { fn(); return null; } catch (error) {return {name: error.name, code: error.code, diagnostics: error.diagnostics};}};
  const missing = capture(() => renderSvg(deck));
  const invalid = capture(() => renderSvg(deck, {date: '22/09/2026'}));
  return {missing, invalid, unchanged: JSON.stringify(deck) === before};
};
`;
const built = await build({stdin: {resolveDir: consumer, contents}, bundle: true, platform: 'browser', format: 'iife', write: false, metafile: true});
const modules = await realpath(path.join(consumer, 'node_modules')), bundleInputs = {};
for (const input of Object.keys(built.metafile.inputs)) {
  if (input === '<stdin>') continue;
  if (input.startsWith('(disabled):')) { bundleInputs[input] = {disabled: true}; continue; }
  const actual = await realpath(path.resolve(input));
  assert.ok(actual.startsWith(modules + path.sep), `Browser code escapes installed consumer: ${input}`);
  bundleInputs[input] = hash(await readFile(actual));
}
const bundle = built.outputFiles[0].text;
const browser = await chromium.launch(), errors = [], requests = [], results = [], controls = [];
let page, activeCase, lastSnapshot, latestExport;
const fonts = registry.embeddedFonts.map(face => ({family: face.family, weight: face.weight, italic: face.italic, sha256: hash(Buffer.from(face.dataUrl.split(',')[1], 'base64'))}));
const binding = {node: process.version, platform: process.platform, browser: browser.version(), mode: 'installed-candidate',
  lockSha256: hash(await readFile(path.join(consumer, 'package-lock.json'))), artifacts, bundleInputs, fonts,
  verifierSha256: hash(await readFile(fileURLToPath(import.meta.url))), bundleSha256: hash(bundle)};
const currentText = date => {
  assert.ok(['2026-09-22', '2026-09-23'].includes(date), 'Expected date must be a known fixture value.');
  return date === '2026-09-22' ? 'September 22, 2026' : 'September 23, 2026';
};
function expectedFooter(index, total, date, hidden) {
  return hidden && index === 0 ? [] : ['Apr 23, 2026', currentText(date), `${index + 1} / ${total}`];
}
function assertFooter(actual, index, total, date, hidden) {
  assert.deepEqual(actual, expectedFooter(index, total, date, hidden));
}
function cacheRows(bytes) {
  const entries = unzipSync(bytes), decode = new TextDecoder();
  return Object.keys(entries).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)\.xml$/)[1]) - Number(b.match(/slide(\d+)\.xml$/)[1]))
    .map(name => ({part: name, paragraphs: [...decode.decode(entries[name]).matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g)]
      .map(match => match[0]).filter(shape => /name="OPF furniture/.test(shape))
      .flatMap(shape => [...shape.matchAll(/<a:p>[\s\S]*?<\/a:p>/g)].map(match => [...match[0].matchAll(/<a:(r|fld)\b([^>]*)>[\s\S]*?<a:t>([^<]*)<\/a:t><\/a:\1>/g)]
        .map(([, kind, attributes, text]) => ({text, ...(kind === 'fld' ? {type: attributes.match(/type="([^"]+)"/)[1]} : {})}))))}));
}
function verifyCaches(rows, document, date, hidden, wrapped = false) {
  assert.equal(rows.length, document.slides.length);
  for (const [index, row] of rows.entries()) {
    const runs = row.paragraphs.flat();
    const numbers = runs.filter(run => run.type === 'slidenum'), dates = runs.filter(run => run.type?.startsWith('datetime'));
    if (hidden && index === 0) {
      assert.deepEqual(numbers, []); assert.deepEqual(dates, []);
      assert.ok(!runs.some(run => run.text.includes('Apr 23, 2026') || run.text.includes(' / ')), 'Title override hides fixed footer text too.');
      continue;
    }
    assert.deepEqual(numbers, [{text: String(index + 1), type: 'slidenum'}]);
    assert.deepEqual(dates, wrapped ? [] : [{text: currentText(date), type: 'datetime4'}]);
    if (wrapped) {
      const numberIndex = runs.findIndex(run => run.type === 'slidenum');
      assert.deepEqual(runs.slice(numberIndex - 2, numberIndex), [{text: 'September '}, {text: currentText(date).slice(10)}],
        'Static wrapped date lines retain exact words and reading order before the slide number.');
    }
    assert.ok(row.paragraphs.some(parts => parts.map(run => run.text).join('') === 'Apr 23, 2026'));
    assert.ok(row.paragraphs.some(parts => parts.map(run => run.text).join('') === `${index + 1} / ${document.slides.length}`));
  }
}
function verifyMappings(source, pagination) {
  const get = (document, field) => field.split('.').reduce((value, key) => value?.[key], document);
  for (const [index, slide] of source.slides.entries()) {
    const sourcePath = `slides.${index}.text`, mappings = pagination.pages.flatMap(page => page.mappings).filter(mapping => mapping.sourcePath === sourcePath);
    let offset = 0; const pieces = [];
    for (const mapping of mappings) {
      const range = mapping.range ?? {unit: 'utf16', start: 0, end: slide.text.length};
      assert.equal(range.unit, 'utf16'); assert.equal(range.start, offset); assert.ok(range.end >= range.start);
      const expected = slide.text.slice(range.start, range.end), actual = get(pagination.presentation, mapping.outputPath);
      assert.equal(actual, expected); pieces.push(actual); offset = range.end;
    }
    assert.equal(offset, slide.text.length); assert.equal(pieces.join(''), slide.text);
  }
}
async function inspect(date, total, hidden) {
  const state = await page.evaluate(() => snapshot()); lastSnapshot = state;
  assert.deepEqual(state.geometry, state.resolved, 'Editor and actual renderer share composition options.');
  assert.deepEqual(state.geometry.diagnostics, []);
  const parts = state.geometry.furniture?.parts ?? [];
  assertFooter(parts.filter(part => part.kind === 'footer').map(part => part.text), state.index, total, date, hidden);
  for (const part of parts) {
    const actual = state.fields.find(field => field.path === part.path);
    assert.equal(actual.selectable, !part.generated);
    assert.equal(actual.lines.length, part.fit.sourceLines.length);
    for (const [index, line] of actual.lines.entries()) {
      const expected = part.fit.sourceLines[index];
      assert.equal(line.start, expected.start); assert.equal(line.end, expected.end);
      assert.equal(line.text, part.text.slice(line.start, line.end), 'Actual DOM text must match its authored/resolved range.');
    }
  }
  assert.deepEqual(await page.evaluate(() => failures), []);
  return state;
}
async function inspectAll(date, total, hidden) {
  while ((await page.evaluate(() => canvasEditor.slideIndex)) > 0) await page.getByRole('button', {name: 'Previous', exact: true}).click();
  const states = [];
  for (let index = 0; index < total; index++) {
    const state = await inspect(date, total, hidden); assert.equal(state.index, index); states.push(state);
    if (index + 1 < total) await page.getByRole('button', {name: 'Next', exact: true}).click();
  }
  return states;
}
async function exportAndCheck(name, date, hidden, source, wrapped = false) {
  await page.getByRole('button', {name: 'Export', exact: true}).click();
  await page.waitForFunction(() => lastImport !== null || failures.length > 0);
  assert.deepEqual(await page.evaluate(() => failures), []);
  const result = await page.evaluate(() => ({bytes: Array.from(lastExport), imported: lastImport, source: editor.document, diagnostics: exportDiagnostics}));
  assert.deepEqual(result.source, source);
  const bytes = Uint8Array.from(result.bytes), rows = cacheRows(bytes);
  latestExport = {file: `${name}.pptx`, sha256: hash(bytes), rows, imported: result.imported, diagnostics: result.diagnostics};
  await writeFile(path.join(output, latestExport.file), bytes);
  await writeFile(path.join(output, `${name}-cache.json`), JSON.stringify(latestExport, null, 2) + '\n');
  verifyCaches(rows, source, date, hidden, wrapped);
  assert.deepEqual(result.diagnostics.map(({code, path}) => ({code, path})), wrapped
    ? source.slides.filter((_, index) => !(hidden && index === 0)).map(() => ({code: 'furniture-field-fixed', path: 'design.footer.center.date'})) : []);
  assert.deepEqual(result.imported.design.footer, source.design.footer);
  assert.deepEqual(result.imported.design.header, source.design.header);
  assert.deepEqual(result.imported.slides.map(slide => slide.design?.footer), source.slides.map(slide => slide.design?.footer));
  // The importer represents plain body text as an ordered text block. Require
  // its exact value and no additional blocks; do not mistake that documented
  // representation change for byte loss within the authored body string.
  assert.deepEqual(result.imported.slides.map(slide => slide.blocks),
    source.slides.map(slide => [{type: 'text', text: slide.text}]));
  assert.deepEqual(result.imported.slides.map(slide => slide.title), source.slides.map(slide => slide.title));
  return latestExport;
}
try {
  page = await browser.newPage({viewport: {width: 1400, height: 1100}});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
  await page.route(/^https?:/, route => {requests.push(route.request().url()); return route.abort();});
  await page.setContent('<button id="previous">Previous</button><button id="next">Next</button><button id="undo">Undo</button><button id="redo">Redo</button><button id="date">Next host date</button><button id="export">Export</button><div id="canvas" style="width:900px"></div>');
  await page.addScriptTag({content: bundle});
  const footer = {left: {date: '2026-04-23', dateFormat: 'MMM d, yyyy'}, center: {date: true, dateFormat: 'MMMM d, yyyy'}, right: {slideNumber: true, slideNumberFormat: '{current} / {total}'}};
  for (const [name, width, height, paginate, wrapped] of [['wide', 1280, 720, false, false], ['portrait', 720, 1280, false, false],
    ['paginated', 1280, 720, true, false], ['portrait-wrapped', 720, 1280, false, true]]) {
    activeCase = name;
    const deck = {design: {fontScheme: 'roboto', dimensions: {widthInches: width / 96, heightInches: height / 96}, header: {left: {text: '  Review\tcopy  \r\n'}}, footer},
      slides: paginate ? [{title: 'Paginated fields', text: 'First sentence with enough detail. '.repeat(160)}, {title: 'Last slide', text: 'Last source body.'}]
        : [{title: 'Hidden title footer', text: 'The title still counts.', design: {footer: false}}, {title: 'Second slide', text: 'Authored second body.'}, {title: 'Third slide', text: 'Authored third body.'}]};
    if (wrapped) for (const slide of deck.slides.slice(1)) slide.composition = {minFontSize: 32, overflow: 'error'};
    const original = structuredClone(deck);
    await page.evaluate(args => mount(args), {deck, faces: registry.embeddedFonts, date: '2026-09-22', paginate});
    const mounted = await page.evaluate(() => ({source: editor.document, authored, pagination, canUndo: editor.canUndo, canRedo: editor.canRedo, events}));
    assert.deepEqual(mounted.authored, original); assert.equal(mounted.canUndo, false); assert.equal(mounted.canRedo, false); assert.deepEqual(mounted.events, []);
    const total = mounted.source.slides.length;
    if (paginate) {assert.ok(total > deck.slides.length); verifyMappings(original, mounted.pagination);}
    else assert.deepEqual(mounted.source, original);
    const before = await inspectAll('2026-09-22', total, !paginate);
    if (wrapped) for (const state of before.slice(1)) {
      assert.deepEqual(state.geometry.furniture.parts.find(part => part.field === 'date' && part.zone === 'center').fit.lines, ['September ', '22, 2026']);
    }
    // Real canvas edit and ordinary undo/redo must preserve generated field settings.
    const target = page.locator('[data-canvas-target][data-opf-path="design.header.left.text"]');
    await target.dblclick(); const input = page.getByRole('textbox', {name: 'Edit text inline', exact: true});
    await input.fill('  Reviewed\tcopy  \r\n'); await input.press('Control+Enter');
    const edited = await page.evaluate(() => editor.document);
    assert.equal(edited.design.header.left.text, '  Reviewed\tcopy  \r\n'); assert.deepEqual(edited.design.footer, footer);
    await page.getByRole('button', {name: 'Undo', exact: true}).click(); assert.deepEqual(await page.evaluate(() => editor.document), mounted.source);
    await page.getByRole('button', {name: 'Redo', exact: true}).click(); assert.deepEqual(await page.evaluate(() => editor.document), edited);
    const exported = await exportAndCheck(`${name}-first-date`, '2026-09-22', !paginate, edited, wrapped);
    await page.getByRole('button', {name: 'Undo', exact: true}).click();
    const historyBefore = await page.evaluate(() => {window.savedEditor = editor; return {source: editor.document, canUndo: editor.canUndo, canRedo: editor.canRedo, events};});
    await page.getByRole('button', {name: 'Next host date', exact: true}).click();
    const historyAfter = await page.evaluate(() => ({sameSession: savedEditor === editor, source: editor.document, canUndo: editor.canUndo, canRedo: editor.canRedo, events}));
    assert.equal(historyAfter.sameSession, true); delete historyAfter.sameSession; assert.deepEqual(historyAfter, historyBefore);
    const after = await inspectAll('2026-09-23', total, !paginate);
    if (wrapped) for (const state of after.slice(1)) {
      assert.deepEqual(state.geometry.furniture.parts.find(part => part.field === 'date' && part.zone === 'center').fit.lines, ['September ', '23, 2026']);
    }
    const updated = await exportAndCheck(`${name}-second-date`, '2026-09-23', !paginate, mounted.source, wrapped);
    assert.throws(() => verifyCaches(updated.rows, mounted.source, '2026-09-22', !paginate, wrapped), assert.AssertionError);
    controls.push({case: name, wrongHostDateRejected: true});
    if (paginate) {
      const fields = after[0].geometry.furniture.parts.filter(part => part.kind === 'footer').map(part => part.text);
      assert.throws(() => assertFooter(fields, 0, deck.slides.length, '2026-09-23', false), assert.AssertionError);
      controls.push({case: name, staleSourceTotalRejected: true, sourceCount: deck.slides.length, finalCount: total});
    }
    await page.getByRole('button', {name: 'Redo', exact: true}).click(); assert.deepEqual(await page.evaluate(() => editor.document), edited);
    await page.getByRole('button', {name: 'Undo', exact: true}).click(); assert.deepEqual(await page.evaluate(() => editor.document), mounted.source);
    assert.deepEqual(await page.evaluate(() => authored), original);
    await page.screenshot({path: path.join(output, `${name}.png`), fullPage: true});
    results.push({name, width, height, original, total, pagination: mounted.pagination, before, after, historyBefore, historyAfter, exported, updated});
  }
  const refused = await page.evaluate(() => refusalControls());
  assert.equal(refused.unchanged, true); assert.equal(refused.missing?.code, 'layout-overflow');
  assert.ok(refused.missing.diagnostics.some(issue => issue.code === 'unresolved-content' && issue.path === 'design.footer.left.date'));
  assert.equal(refused.invalid?.name, 'RangeError'); controls.push({refused});
  assert.deepEqual(errors, []); assert.deepEqual(requests, []); assert.deepEqual(await page.evaluate(() => failures), []);
  await writeFile(path.join(output, 'report.json'), JSON.stringify({...binding, results, controls, errors, requests,
    scope: 'Four offline installed-candidate workflows: explicit host date, actual SVG source ranges, generated-field editability, hidden-title count, native PPTX cached fields, static wrapped-date diagnostics and unchanged OPF intent recovery, source-preserving edit/undo and final pagination mappings. No native PowerPoint refresh/save/reopen, registry floor, raw JSON lexical preservation or general parity claim.'}, null, 2) + '\n');
  console.log('Installed furniture fields passed: 4 browser workflows, shared host dates, final totals, actual source ranges, edit/undo, cached PPTX fields, static wrapped-date recovery and refusal/oracle controls.');
} catch (error) {
  await writeFile(path.join(output, 'failure.json'), JSON.stringify({...binding, activeCase, message: error.message, stack: error.stack, lastSnapshot, latestExport, results, controls, errors, requests}, null, 2) + '\n');
  try {await page?.screenshot({path: path.join(output, 'failure-page.png'), fullPage: true});} catch { /* Original failure remains authoritative. */ }
  throw error;
} finally {await browser.close();}
