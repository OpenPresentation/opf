// Two and three equal peer columns across every schema content kind. No engine/default edits.
// Run: node --import ./scripts/register-local-opf.mjs scripts/design-audit-columns.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gallery } from '@openpresentation/gallery';
import { validate, resolveSlideContext } from '../packages/javascript/dist/index.js';
import { composeSlide, layoutTable } from '../packages/javascript/dist/composition.js';
import { loadFonts } from '../../opf-render/dist/fonts-node.js';
import { resolvePresentation, toPng, toSvg } from '../../opf-render/dist/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(process.argv[2] ?? path.join(root, 'artifacts/design-audit/columns'));
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const save = (name, value) => writeFile(path.join(output, name), `${JSON.stringify(value, null, 2)}\n`);
const revision = directory => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' }).trim();
const schemaFile = path.join(root, 'spec/schemas/opf.schema.json');
const schema = await readJson(schemaFile);
const kinds = schema.$defs.ContentPayload.properties.type.enum;
const leafKinds = kinds.filter(kind => kind !== 'group');
const payloadFields = Object.keys(schema.$defs.ContentPayload.properties).filter(key => ['text', 'items', 'bullets', 'image', 'video', 'chart', 'table', 'code', 'metric', 'quote', 'timeline', 'blocks'].includes(key));
assert.equal(leafKinds.length, 10);
assert.equal(kinds.length, 11);

// This is the actual gallery record maintained by the layout-tuning work. Preserve it inline, including its timeline fix.
const twoColumnFile = path.join(root, 'artifacts/design-audit/gallery-source/catalog/layouts/two-column.json');
const twoPublished = await readJson(twoColumnFile);
const { $schema: twoSchema, id: twoId, ...twoColumn } = twoPublished;
assert.equal(twoSchema, 'https://openpresentation.org/schema/opf-layout/v2');
assert.equal(twoId, 'two-column');
for (const region of Object.values(twoColumn.regions)) for (const kind of kinds) assert.ok(region.accepts.includes(kind), `two-column region must accept ${kind}; use the reviewed gallery correction`);
const threeColumn = {
  name: 'Three columns candidate',
  summary: 'Three independent equal peer columns of any supported content kind.',
  areas: [['title', 'title', 'title'], ['first', 'second', 'third']],
  columns: [1, 1, 1], rows: ['auto', 1],
  regions: Object.fromEntries(['first', 'second', 'third'].map(name => [name, { accepts: [...kinds], role: 'primary', flow: 'none' }])),
};
const catalogFor = columns => columns === 2
  ? { default: { source: 'https://www.pptx.gallery', layouts: { 'two-column': twoColumn } } }
  : { custom: { layouts: { 'three-column-candidate': threeColumn } } };
const layoutFor = columns => columns === 2 ? 'two-column' : 'custom:three-column-candidate';

const paragraphs = [
  'A focused pilot gives the team a clear decision. Test one workflow, establish a baseline, and agree what result would justify expanding.',
  'Keep a named owner from intake through the final decision. The owner collects the evidence, explains exceptions, and records what happens next. Review the first results with the pilot team before adding a second workflow.',
  'Expansion should follow evidence rather than a fixed launch calendar. Compare the pilot with its baseline, investigate recurring exceptions, and check that support can absorb more participants. A slower expansion can be useful when it preserves response quality and exposes the remaining dependencies before they affect every team.',
];
const listEntries = [
  [
    { text: 'Name the decision owner', description: 'Make accountability visible from intake through closure.' },
    { text: 'Publish the checklist', description: 'Keep the entry criteria available to every participant.' },
    { text: 'Record the outcome', description: 'Explain the next step and who will take it.' },
  ],
  [
    { text: 'Measure the starting point', description: 'Track review time, escalation rate, and task completion.' },
    { text: 'Review feedback weekly', description: 'Separate one-off requests from repeated workflow problems.' },
    { text: 'Close access blockers', description: 'Give each dependency an owner and useful decision date.' },
    { text: 'Protect support capacity', description: 'Expand only when the team can maintain its response targets.' },
  ],
  [
    { text: 'Keep one workflow in scope', description: 'Use the same decision criteria across the pilot.' },
    { text: 'Retain the baseline', description: 'Compare changes against the original measures.' },
    { text: 'Rehearse exceptions', description: 'Test the route before additional teams join.' },
    { text: 'Confirm the support rotation', description: 'Make ownership clear outside normal hours.' },
    { text: 'Choose the next rollout', description: 'Use the evidence to set a sustainable pace.' },
  ],
];
const chartPayload = index => ({
  type: ['column', 'line', 'bar'][index % 3],
  axisTitles: { category: 'Week', value: 'Task completion' },
  data: { columns: ['Week', { name: 'Task completion', format: '0%' }], rows: [['1', .62 + index * .03], ['2', .69 + index * .02], ['3', .76 + index * .02], ['4', .84 + index * .01]] },
});
const tablePayload = index => ({
  columns: ['Measure', 'Baseline', 'Pilot'],
  rows: [
    ['Task completion', '68%', '84%'], ['Median review (h)', '44', '19'], ['Escalation rate', '11%', '6%'],
    ...[[], [['First response on time', '81%', '92%']], [['First response on time', '81%', '92%'], ['Participant satisfaction', '3.8 / 5', '4.6 / 5']]][index % 3],
  ],
});
const codeSources = [
  'function routeReview(request) {\n  if (request.risk > 3) {\n    return escalate(request);\n  }\n  return approve(request);\n}',
  'function recordDecision(review) {\n  const result = {\n    owner: review.owner,\n    outcome: review.outcome,\n    nextStep: review.nextStep\n  };\n  return saveDecision(result);\n}',
  'function readyToExpand(pilot) {\n  const accessReady =\n    pilot.openBlockers === 0;\n  const supportReady =\n    pilot.responseRate >= 0.9;\n\n  return accessReady &&\n    supportReady;\n}',
];
const quotes = [
  'I could see who owned the request and what would happen next.',
  'The weekly review gave us one place to explain the exceptions, agree who would resolve them, and keep the routine requests moving.',
  'A clear baseline changed the rollout discussion. We could compare the new process with the old one, see which teams needed help, and choose the next step without relying on the loudest anecdote.',
];
const timelinePayload = index => ({
  name: ['Product readiness', 'Operations readiness', 'Evidence review'][index % 3],
  events: [
    { when: 'Week 1', what: ['Close access', 'Name owners', 'Set baseline'][index % 3], description: ['Resolve the two known blockers.', 'Publish the support rotation.', 'Record the starting measures.'][index % 3] },
    { when: 'Week 2', what: ['Rehearse support', 'Test escalation', 'Collect feedback'][index % 3], description: ['Review the exception route.', 'Check response coverage.', 'Discuss the recurring issues.'][index % 3] },
    { when: 'Week 3', what: ['Add pilot team', 'Review capacity', 'Choose next step'][index % 3], description: ['Keep one workflow in scope.', 'Confirm the next rollout pace.', 'Compare results with baseline.'][index % 3] },
  ],
});
const factories = {
  text: index => ({ text: paragraphs[index % 3] }),
  list: index => ({ items: listEntries[index % 3] }),
  image: () => ({ image: 'asset:landscape' }),
  chart: index => ({ chart: chartPayload(index) }),
  table: index => ({ table: tablePayload(index) }),
  video: index => ({ video: { src: `https://example.invalid/pilot-walkthrough-${index + 1}.mp4`, title: ['Intake walkthrough', 'Exception review', 'Results discussion'][index % 3], alt: 'Illustrative linked-video placeholder; playback is not tested', mediaType: 'video/mp4' } }),
  code: index => ({ code: { source: codeSources[index % 3], language: 'javascript', filename: ['route-review.js', 'record-decision.js', 'ready-to-expand.js'][index % 3] } }),
  metric: index => ({ metric: [
    { value: '84%', label: 'Task completion', description: 'Up from 68% at baseline' },
    { value: '6.2', unit: 'min', label: 'Median task time', description: 'Down from 9.4 min before the pilot' },
    { value: '92%', label: 'First response on time', description: 'Above the 90% operating target across the pilot teams' },
  ][index % 3] }),
  quote: index => ({ quote: { text: quotes[index % 3], attribution: ['Pilot participant', 'Operations lead', 'Analytics lead'][index % 3], source: 'Illustrative interview excerpt' } }),
  timeline: index => ({ timeline: timelinePayload(index) }),
  group: index => index === 2 ? ({ blocks: [
    { text: 'Analytics team' },
    { blocks: [{ metric: { value: '4 weeks', label: 'Review cadence' } }, { text: 'Compare the same measures with the original baseline before choosing the next rollout.' }] },
  ] }) : ({ blocks: [
    { text: ['Product team', 'Operations team'][index % 2] },
    { items: index === 0 ? ['Resolve access blockers.', 'Confirm release scope.', 'Prepare the next pilot build.'] : ['Publish the support rotation.', 'Rehearse the exception route.', 'Review response-time trends.'] },
  ] }),
};
assert.deepEqual(Object.keys(factories).sort(), [...kinds].sort(), 'Every actual schema kind needs a fixture factory');

await mkdir(output, { recursive: true });
const illustrationFile = path.join(root, 'artifacts/design-audit/gallery/baseline/cover.opf.json');
const illustrationDeck = await readJson(illustrationFile);
const imageSource = illustrationDeck.slides[0].blocks.find(block => block.image).image.src;
assert.ok(imageSource.startsWith('data:image/svg+xml;base64,'));
const assets = { landscape: { src: imageSource, alt: 'Unmodified illustrative landscape from the gallery cover fixture', mediaType: 'image/svg+xml' } };
const fontsDiagnostics = [];
const fonts = await loadFonts({ pack: 'office', onDiagnostic: issue => fontsDiagnostics.push(issue) });
const options = { fonts, catalogs: [gallery], text: 'paths', trace: true };
const cases = [];
for (const kind of kinds) for (const columns of [2, 3]) cases.push({
  id: `homogeneous-${kind}-${columns}col`, category: 'homogeneous', columns, kinds: Array(columns).fill(kind),
  title: `${columns === 2 ? 'Two' : 'Three'} peer columns of ${kind === 'group' ? 'related groups' : kind}`,
  blocks: Array.from({ length: columns }, (_, index) => factories[kind](index)),
  probe: `Equal peer allocations for ${kind}; content length and internal density vary without styling overrides.`,
});
const mixed = [
  ['chart-text', 'Evidence and interpretation', ['chart', 'text']],
  ['table-text', 'Read the operating measures beside the decision', ['table', 'text']],
  ['image-text', 'Review visual context beside its explanation', ['image', 'text']],
  ['code-text', 'Keep the implementation beside its purpose', ['code', 'text']],
  ['quote-metric-text', 'Connect the experience with the evidence', ['quote', 'metric', 'text']],
  ['timeline-list-metric', 'Connect the rollout with its operating gate', ['timeline', 'list', 'metric']],
  ['group-chart-table', 'Compare responsibilities and operating evidence', ['group', 'chart', 'table']],
  ['text-bullets-list', 'Compare paragraph, talking points, and structured list', ['text', 'text', 'list']],
  ['timeline-image', 'Review the rollout beside the field context', ['timeline', 'image']],
  ['video-image-text', 'Video placeholder, visual reference, and explanation', ['video', 'image', 'text']],
];
for (const [id, title, contentKinds] of mixed) {
  const blocks = contentKinds.map((kind, index) => factories[kind](index));
  if (id === 'text-bullets-list') blocks[1] = { bullets: ['Keep one accountable owner.', 'Review the evidence weekly.', 'Record the next decision.'] };
  cases.push({ id: `mixed-${id}`, category: 'mixed', columns: blocks.length, kinds: contentKinds, title, blocks, probe: 'Equal peer columns retain semantic differences in content; no primary-evidence weights or visual styling are authored.' });
}
assert.equal(cases.filter(item => item.category === 'homogeneous').length, 22);
assert.equal(cases.filter(item => item.category === 'mixed').length, 10);

const summarize = geometry => geometry.items.map(item => ({
  path: item.path, kind: item.field, region: item.region, box: item.box,
  ...(item.text ? { fontSize: item.text.fontSize, lines: item.text.lines.length, overflow: item.text.overflow } : {}),
  ...Object.fromEntries(['quoteLayout', 'codeLayout', 'metricLayout', 'timelineLayout'].filter(key => item[key]).map(key => [key, {
    overflow: item[key].overflow,
    parts: item[key].parts.map(part => ({ role: part.role, box: part.box, fontSize: part.fit?.fontSize, lines: part.fit?.lines.length, overflow: part.fit?.overflow })),
  }])),
}));
const entries = [];
const renderDeck = async (id, deck, metadata = {}) => {
  const before = hash(JSON.stringify(deck));
  const validation = validate(deck, { fonts, catalogs: [gallery] });
  assert.equal(validation.valid, true, `${id}: ${JSON.stringify(validation.findings.filter(finding => finding.severity === 'error'))}`);
  const bound = resolvePresentation(deck, options).slides[0];
  const context = resolveSlideContext(deck, 0, { fonts, catalogs: [gallery] });
  const geometry = composeSlide(context.slide, { ...context.options, fontFamilies: bound.design.fonts, textMeasurement: bound.textMeasurement, explain: true });
  const { explanation, ...unexplained } = geometry;
  assert.deepEqual(unexplained, bound.geometry, `${id}: explanation and renderer must share exact geometry`);
  if (metadata.category === 'homogeneous' || metadata.category === 'mixed') {
    assert.equal(geometry.regions.length, metadata.columns, `${id}: the requested peer columns must exist`);
    assert.ok(geometry.regions.every(region => region.content.length === 1), `${id}: each root payload must bind to its own column`);
    const widths = geometry.regions.map(region => region.box.width);
    assert.ok(Math.max(...widths) - Math.min(...widths) < .0001, `${id}: peer column widths must remain equal`);
    assert.ok(geometry.regions.every(region => Math.abs(region.box.y - geometry.regions[0].box.y) < .0001 && Math.abs(region.box.height - geometry.regions[0].box.height) < .0001), `${id}: peer columns must share their top and height`);
  }
  const tables = geometry.items.filter(item => item.field === 'table').map(item => ({ path: item.path, layout: layoutTable(item.value, item.box, { scale: Math.min(geometry.width, geometry.height) / 720, minFontSize: item.composition.minFontSize, fontFamily: bound.design.fonts.body, textMeasurement: bound.textMeasurement, path: item.path }) }));
  const renderDiagnostics = [];
  const svg = toSvg(deck, 1, { ...options, onDiagnostic: issue => renderDiagnostics.push(issue) });
  const png = await toPng(svg, { fonts });
  assert.equal(hash(JSON.stringify(deck)), before, `${id}: render must not mutate content`);
  await save(`${id}.opf.json`, deck);
  await writeFile(path.join(output, `${id}.svg`), svg);
  await writeFile(path.join(output, `${id}.png`), png);
  await save(`${id}.geometry.json`, { geometry, tables, resolvedDesign: bound.design });
  await save(`${id}.findings.json`, { validation, geometryDiagnostics: geometry.diagnostics, renderDiagnostics, contextDiagnostics: context.diagnostics });
  const entry = {
    id, title: deck.slides[0].title, ...metadata,
    files: { input: `${id}.opf.json`, svg: `${id}.svg`, png: `${id}.png`, geometry: `${id}.geometry.json`, findings: `${id}.findings.json` },
    sha256: { input: hash(JSON.stringify(deck)), svg: hash(svg), png: hash(png) },
    geometryDiagnostics: geometry.diagnostics, renderDiagnostics, validationCounts: validation.counts,
    layoutValidationFailures: validation.findings.filter(finding => finding.ruleId === 'opf/layout-failed').map(({ path: at, message }) => ({ path: at, message })),
    items: summarize(geometry),
    tableFit: tables.map(({ path: tablePath, layout }) => ({ path: tablePath, overflow: layout.overflow, columns: layout.columnCount, rows: layout.rows.length, fontSizes: [...new Set(layout.rows.flatMap(row => row.cells.map(cell => cell.fit.fontSize)))] })),
    unmeasuredPayloads: explanation.unmeasuredPayloads,
    fontsResolved: bound.design.fonts,
  };
  console.log(`${id}: ${geometry.diagnostics.length} geometry findings, ${validation.counts.warning} validation warnings`);
  return entry;
};

for (const [index, item] of cases.entries()) {
  const deck = { name: item.title, slides: [{ layout: layoutFor(item.columns), title: item.title, blocks: item.blocks }],
    ...(JSON.stringify(item.blocks).includes('asset:landscape') ? { assets } : {}), catalogs: catalogFor(item.columns) };
  entries.push(await renderDeck(item.id, deck, { order: index + 1, category: item.category, columns: item.columns, kinds: item.kinds, probe: item.probe, layoutSource: item.columns === 2 ? 'Corrected actual gallery two-column record, preserved inline.' : 'Embedded three-column candidate, all11 supported schema kinds explicitly accepted.' }));
}

// Preserve an exact negative control and its same-content layout-record-only correction.
const negativeFile = path.join(output, 'two-column-timeline-negative.opf.json');
let negative;
try { negative = await readJson(negativeFile); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const priorFile = path.join(root, 'artifacts/design-audit/candidates/records/two-column-before.json');
  const { $schema: _priorSchema, id: _priorId, ...prior } = await readJson(priorFile);
  negative = {
    name: 'Two rollout plans', slides: [{ layout: 'two-column', title: 'Two rollout plans use the same checkpoints', blocks: [
      { timeline: { name: 'Product readiness', events: [{ when: 'Week 1', what: 'Close access' }, { when: 'Week 2', what: 'Rehearse support' }, { when: 'Week 3', what: 'Add pilot team' }] } },
      { timeline: { name: 'Operations readiness', events: [{ when: 'Week 1', what: 'Name owners' }, { when: 'Week 2', what: 'Test escalation' }, { when: 'Week 3', what: 'Review baseline' }] } },
    ] }], catalogs: { default: { source: 'https://www.pptx.gallery', layouts: { 'two-column': prior } } },
  };
}
const fixed = structuredClone(negative);
fixed.catalogs.default.layouts['two-column'] = structuredClone(twoColumn);
assert.deepEqual(fixed.slides, negative.slides, 'Timeline correction must preserve exact slides and payloads');
const controls = [
  await renderDeck('two-column-timeline-negative', negative, { order: 33, category: 'negative-control', columns: 2, kinds: ['timeline', 'timeline'] }),
  await renderDeck('two-column-timeline-fixed', fixed, { order: 34, category: 'fixed-control', columns: 2, kinds: ['timeline', 'timeline'] }),
];
assert.equal(controls[0].geometryDiagnostics.filter(issue => issue.code === 'layout-unplaced').length, 2);
assert.equal(controls[1].geometryDiagnostics.filter(issue => issue.code === 'layout-unplaced').length, 0);

const escapeXml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const sheetWidth = 1920, sheetHeight = 420, margin = 16, gap = 16, panel = (sheetWidth - margin * 2 - gap * 2) / 3;
const batches = [];
for (let start = 0; start < entries.length; start += 3) {
  const subset = entries.slice(start, start + 3), number = Math.floor(start / 3) + 1;
  const pieces = [];
  for (const [index, entry] of subset.entries()) {
    const svg = await readFile(path.join(output, entry.files.svg));
    const x = margin + index * (panel + gap);
    pieces.push(`<text x="${x}" y="29" font-family="Intos" font-size="20" font-weight="700" fill="#1f2937">${escapeXml(`${String(entry.order).padStart(2, '0')} ${entry.id}`)}</text>`);
    pieces.push(`<image x="${x}" y="48" width="${panel}" height="${panel * 9 / 16}" href="data:image/svg+xml;base64,${svg.toString('base64')}"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetWidth}" height="${sheetHeight}"><rect width="100%" height="100%" fill="white"/>${pieces.join('')}</svg>`;
  const name = `batch-${String(number).padStart(2, '0')}`;
  await writeFile(path.join(output, `${name}.svg`), svg);
  await writeFile(path.join(output, `${name}.png`), await toPng(svg, { fonts }));
  batches.push({ number, ids: subset.map(entry => entry.id), png: path.join(output, `${name}.png`), svg: path.join(output, `${name}.svg`) });
}
const fontFiles = await Promise.all(fonts.fontFiles.map(async file => ({ file: path.relative(root, file), sha256: hash(await readFile(file)) })));
const manifest = {
  scope: '22 homogeneous tests (two and three columns for10 leaf kinds plus group),10 mixed tests, and exact timeline acceptance negative/fixed controls. No engine, schema, or default changes.',
  command: 'node --import ./scripts/register-local-opf.mjs scripts/design-audit-columns.mjs',
  provenance: { node: process.version, core: { version: (await readJson(path.join(root, 'packages/javascript/package.json'))).version, revision: revision(root) }, renderer: { version: (await readJson(path.join(root, '../opf-render/package.json'))).version, revision: revision(path.join(root, '../opf-render')) }, galleryVersion: (await readJson(path.join(root, 'node_modules/@openpresentation/gallery/package.json'))).version,
    twoColumnRecord: { file: path.relative(root, twoColumnFile), sha256: hash(await readFile(twoColumnFile)), record: twoColumn }, threeColumnRecord: threeColumn,
    schema: { file: path.relative(root, schemaFile), sha256: hash(await readFile(schemaFile)), contentKinds: kinds, leafKinds, payloadFields, notes: ['items is the structured list payload and infers list.', 'bullets is a separate prose payload and infers text; exercised in the mixed text-bullets-list case.', 'blocks contains group children; group is structural, not an eleventh leaf kind.', 'Video and Asset schemas expose no poster field. The renderer draws a titled play placeholder; no video is fetched, played, or embedded. An image in the mixed video case is a separate visual reference, not a claimed video poster.'] },
    fonts: { pack: 'office', substitutions: fonts.substitutions, diagnostics: fontsDiagnostics, files: fontFiles, text: 'paths', loadSystemFonts: false, sameHandleForMeasurementAndRaster: true },
    illustration: { file: path.relative(root, illustrationFile), dataSha256: hash(imageSource), unmodified: true },
  },
  limits: ['Validation and measured geometry do not certify visual quality or native PowerPoint fidelity.', 'Some full-validation reports carry opf/layout-failed font-policy warnings. Renderer measurements succeed with the same loaded office handle: its selected Aptos roles first resolve at400/700 to Intos, while core validation requests unsupported intermediate Aptos weights directly. These warnings are retained, not suppressed; exact messages are in findings and layoutValidationFailures.', 'Charts, video, and image optical balance require visual review; explanation explicitly identifies unmeasured payload internals.', 'All fixtures preserve equal peer tracks; mixed evidence and commentary may call for different proportions in a real slide.', 'The embedded three-column candidate is an audit fixture, not an installed or published gallery layout.'],
  counts: { homogeneous: 22, mixed: 10, controls: 2, contactSheets: batches.length }, entries, controls, batches,
};
await save('manifest.json', manifest);
await save('contact-sheets.json', { width: sheetWidth, height: sheetHeight, batches });
await writeFile(path.join(output, 'README.md'), `# Equal-column content matrix\n\n${manifest.scope}\n\nTwo columns use the corrected actual gallery record, with timeline acceptance added by layout tuning. Three columns use one embedded structural candidate declaring every schema kind; neither carries optional visual styling. All words, data, assets, measured fonts, exact geometry and findings accompany the previews.\n\nVideo is tested as the supported titled play placeholder. The schema has no poster field, and no playback is implied.\n\nSome validation reports retain a font-policy layout warning: the validator requests intermediate Aptos weights directly, while the renderer first resolves the selected roles to loaded Intos families. Rendering succeeds with the same pinned handle. The warnings are preserved and require a separate shared-context investigation; they are not a claim that those layouts passed every validation check.\n\n[Machine-readable manifest](manifest.json) · [Three-up sheet index](contact-sheets.json)\n\n| No. | Case | Contents | Findings |\n| --- | --- | --- | --- |\n${entries.map(entry => `| ${entry.order} | [${entry.id}](${entry.files.png}) | ${entry.kinds.join(', ')} | ${entry.geometryDiagnostics.length} geometry; ${entry.validationCounts.warning} validation warnings |`).join('\n')}\n\nThe timeline [negative control](two-column-timeline-negative.png) and [fixed control](two-column-timeline-fixed.png) retain identical content. Only their embedded two-column acceptance record differs.\n`);
console.log(`Prepared ${entries.length} matrix cases,2 controls, and ${batches.length} three-up sheets in ${output}`);
