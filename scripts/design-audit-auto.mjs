// Local evidence for a three-at-a-time design review. Does not alter OPF or catalog defaults.
// Run: node --import ./scripts/register-local-opf.mjs scripts/design-audit-auto.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gallery } from '@openpresentation/gallery';
import { resolveSlideContext, validate } from '../packages/javascript/dist/index.js';
import { composeSlide } from '../packages/javascript/dist/composition.js';
import { loadFonts } from '../../opf-render/dist/fonts-node.js';
import { resolvePresentation, toPng, toSvg } from '../../opf-render/dist/index.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(process.argv[2] ?? path.join(root, 'artifacts/design-audit/auto'));
const hash = value => createHash('sha256').update(value).digest('hex');
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const writeJson = (file, value) => writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
const sourceRevision = directory => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: directory, encoding: 'utf8' }).trim();
const t = text => ({ text });
const metric = (value, label, description) => ({ metric: { value, label, ...(description ? { description } : {}) } });
const chart = {
  type: 'line',
  data: { columns: ['Month', 'Median review hours'], rows: [['Apr', 44], ['May', 39], ['Jun', 34], ['Jul', 29], ['Aug', 24], ['Sep', 19]] },
};

// Ordinary content only: no design object, layout id, pins, sizes, colors, manual breaks, weights, or gap tuning.
// In current OPF omission of layout and composition is automatic composition. Groups express related content.
const cases = [
  {
    id: '01-single-takeaway', purpose: 'One short message; sparse-slide balance and body scale.',
    slide: { title: 'Remove the handoff that slows every review', text: 'Give one owner responsibility from intake through decision. A shared queue makes exceptions visible and keeps routine work moving.' },
  },
  {
    id: '02-two-equal-ideas', purpose: 'Two comparable observations with similar text lengths.',
    slide: { title: 'Improve speed and preserve accountability', blocks: [
      t('Speed improves when routine requests move directly to an accountable owner. Clear entry criteria reduce repeated triage and unnecessary handoffs.'),
      t('Accountability improves when the owner records the decision and supporting evidence. Exceptions remain visible without slowing every routine request.'),
    ] },
  },
  {
    id: '03-three-pillars', purpose: 'Three short parallel ideas; compare row versus stacked choice.',
    slide: { title: 'Three habits make the process dependable', blocks: [
      t('Clarify the decision. State what needs approval and which evidence matters.'),
      t('Keep one owner. Make the person responsible visible from intake to closure.'),
      t('Close the loop. Record the result and share what changes for the next request.'),
    ] },
  },
  {
    id: '04-uneven-comparison', purpose: 'Two related arguments with very unequal space needs.',
    slide: { title: 'The exception path needs the explanation', blocks: [
      t('Routine requests stay with one owner and follow the published checklist.'),
      t('Exceptions need a brief review of the decision, its reversibility, and the evidence that is still missing. The owner should identify the practical consequence of waiting, the person who can resolve the uncertainty, and the latest useful decision date. A clear exception path protects important decisions while allowing routine work to continue. Record the reason for escalation so the team can improve the checklist when the same uncertainty recurs.'),
    ] },
  },
  {
    id: '05-four-workstreams', purpose: 'Four equal blocks; density and vertical rhythm.',
    slide: { title: 'Four workstreams support the launch', blocks: [
      t('Product readiness: finish the essential workflow, resolve the remaining access issues, and freeze the first release scope.'),
      t('Customer readiness: confirm the pilot group, prepare the support route, and give every participant a clear start date.'),
      t('Operational readiness: assign service owners, rehearse the exception path, and publish the first response targets.'),
      t('Measurement readiness: establish the baseline, instrument the critical steps, and agree how the team will review results.'),
    ] },
  },
  {
    id: '06-five-priorities', purpose: 'Odd item count; incomplete final row and balance.',
    slide: { title: 'Focus the next month on five priorities', blocks: [
      t('Resolve the two access issues that block pilot users.'),
      t('Reduce the number of decisions that require a handoff.'),
      t('Publish a clear owner for every recurring exception.'),
      t('Measure the time from intake to the final decision.'),
      t('Review the first results with the pilot team each Friday.'),
    ] },
  },
  {
    id: '07-six-operating-metrics', purpose: 'Six metrics; shared value and label alignment.',
    slide: { title: 'Operating performance improved across the funnel', blocks: [
      metric('19 h', 'Median review', 'Down from 44 hours in April'),
      metric('92%', 'First response on time', 'Target: 90 percent'),
      metric('6%', 'Escalation rate', 'Down from 11 percent'),
      metric('148', 'Completed reviews', 'September total'),
      metric('4.6 / 5', 'Reviewer satisfaction', 'Based on 86 responses'),
      metric('2', 'Unresolved blockers', 'Both assigned to owners'),
    ] },
  },
  {
    id: '08-seven-actions', purpose: 'Seven short blocks; leftover placement and reading order.',
    slide: { title: 'Make the pilot ready for Monday', blocks: [
      t('Confirm the pilot participants.'), t('Grant the required permissions.'), t('Publish the intake checklist.'),
      t('Assign the support rotation.'), t('Test the exception route.'), t('Check the baseline dashboard.'), t('Send the launch brief.'),
    ] },
  },
  {
    id: '09-nine-checkpoints', purpose: 'Nine concise blocks; small-cell thresholds and scan order.',
    slide: { title: 'Use the same checkpoints for every review', blocks: [
      t('Decision: what must be approved?'), t('Owner: who is accountable?'), t('Evidence: what supports the choice?'),
      t('Risk: what could go wrong?'), t('Reversibility: can we change course?'), t('Dependencies: who else is affected?'),
      t('Timing: when is the decision useful?'), t('Record: where is the result stored?'), t('Learning: what should change next time?'),
    ] },
  },
  {
    id: '10-chart-and-takeaway', purpose: 'One chart and one short interpretation; evidence versus commentary proportions.',
    slide: { title: 'Review time fell as handoffs were removed', blocks: [
      { chart }, t('Median review time fell 57% between April and September. The largest gains followed the move to one accountable owner per request.'),
    ] },
  },
  {
    id: '11-table-and-decision', purpose: 'A readable analytical table beside a concise decision.',
    slide: { title: 'Expand the pilot after the remaining blockers close', blocks: [
      { table: { columns: ['Readiness measure', 'Current', 'Target'], rows: [
        ['First response on time', '92%', '90%'], ['Median review', '19 h', '24 h'], ['Escalations', '6%', '8%'],
        ['Open access blockers', '2', '0'], ['Pilot satisfaction', '4.6 / 5', '4.3 / 5'],
      ] } },
      t('Approve expansion when both access blockers have named resolutions and the support team has rehearsed the escalation route.'),
    ] },
  },
  {
    id: '12-image-and-explanation', purpose: 'Illustrative landscape image with contextual copy; fit and empty space.',
    assets: ['landscape'],
    slide: { title: 'Keep field context visible during planning', blocks: [
      { image: 'asset:landscape' },
      t('The pilot team reviews the site context alongside the proposed work. A shared visual reference helps explain access constraints, seasonal conditions, and the sequence of activities.'),
    ] },
  },
  {
    id: '13-image-pair-and-note', purpose: 'Two matching image allocations and one short note; three mixed blocks.',
    assets: ['landscape'],
    slide: { title: 'Review visual evidence as a pair', blocks: [
      { image: 'asset:landscape' }, { image: 'asset:landscape' },
      t('Use a consistent framing when comparing sites. These duplicated illustrations isolate layout behavior; they are not evidence of two different locations.'),
    ] },
  },
  {
    id: '14-quote-and-implication', purpose: 'Quote, attribution, and a short interpretation.',
    slide: { title: 'A visible owner changes the customer experience', blocks: [
      { quote: { text: 'I knew who was handling the request and what would happen next. I no longer had to chase three teams for an update.', attribution: 'Pilot participant', source: 'Illustrative interview excerpt' } },
      t('Preserve a visible owner and an explicit next step as the pilot grows. These two details made progress easier to understand.'),
    ] },
  },
  {
    id: '15-timeline-and-risks', purpose: 'Timeline and related risks; timeline internal label fit.',
    slide: { title: 'Expand in stages while closing the access risks', blocks: [
      { timeline: { events: [
        { when: 'Week 1', what: 'Resolve access', description: 'Close both known blockers.' },
        { when: 'Week 2', what: 'Rehearse support', description: 'Test the escalation route.' },
        { when: 'Week 3', what: 'Expand pilot', description: 'Add the second team.' },
        { when: 'Week 4', what: 'Review results', description: 'Decide the next rollout.' },
      ] } },
      { items: ['Access depends on one external approval.', 'Support capacity must cover the second team.', 'Keep the original baseline for comparison.'] },
    ] },
  },
  {
    id: '16-code-and-explanation', purpose: 'A short code example and supporting explanation.',
    slide: { title: 'Make the escalation rule explicit', blocks: [
      { code: { language: 'javascript', filename: 'review-policy.js', source: 'function routeReview(request) {\n  if (request.irreversible || request.risk > 3) {\n    return escalateToOwner(request);\n  }\n  return approveRoutineRequest(request);\n}' } },
      t('Escalate irreversible or high-risk requests to the accountable owner. Routine decisions keep moving through the standard path, and every result is recorded.'),
    ] },
  },
  {
    id: '17-two-nested-groups', purpose: 'Related heading and list pairs expressed only by nesting.',
    slide: { title: 'Keep each owner close to their responsibilities', blocks: [
      { blocks: [t('Product team'), { items: ['Resolve access blockers.', 'Confirm release scope.', 'Prepare the next pilot build.'] }] },
      { blocks: [t('Operations team'), { items: ['Publish the support rotation.', 'Rehearse the exception route.', 'Review response-time trends.'] }] },
    ] },
  },
  {
    id: '18-three-nested-comparisons', purpose: 'Three nested comparisons; title, metric, and supporting sentence proximity.',
    slide: { title: 'Choose the rollout pace that support can sustain', blocks: [
      { blocks: [t('Conservative'), metric('1 team', 'Added per month'), t('Lowest support load. Slower learning across different workflows.')] },
      { blocks: [t('Recommended'), metric('2 teams', 'Added per month'), t('Balances support capacity with a useful pace of learning.')] },
      { blocks: [t('Accelerated'), metric('4 teams', 'Added per month'), t('Requires a dedicated support rotation and earlier access approvals.')] },
    ] },
  },
  {
    id: '19-long-heading-and-list', purpose: 'Long but ordinary title and subtitle; pressure on heading and body space.',
    slide: {
      title: 'The next rollout should preserve clear ownership while giving support time to resolve the remaining access dependencies',
      subtitle: 'A measured expansion creates enough variation to test the process without overwhelming the team.',
      items: ['Close the remaining access blockers before adding participants.', 'Expand by two teams and retain the same accountable-owner model.', 'Review response time, escalations, and satisfaction after four weeks.', 'Use the results to choose the pace for the following month.'],
    },
  },
  {
    id: '20-mixed-business-review', purpose: 'Chart, metric, list, and concise recommendation; mixed-content hierarchy.',
    slide: { title: 'Expand the pilot with a clear support gate', blocks: [
      { chart }, metric('57%', 'Faster median review', 'April to September'),
      { items: ['Response targets are being met.', 'Pilot satisfaction exceeds the target.', 'Two access blockers remain open.'] },
      t('Add the next two teams after both blockers close. Review the first month before committing to a faster rollout.'),
    ] },
  },
];

assert.equal(cases.length, 20);
await mkdir(path.join(output, 'assets'), { recursive: true });
// Reuse the gallery's own unmodified, offline example image. It is illustration, not photographic evidence.
const imageFile = path.join(root, '../pptx-gallery/data/layout-example-image.json');
const imageSource = await readJson(imageFile);
assert.ok(typeof imageSource === 'string' && imageSource.startsWith('data:image/png;base64,'));
const imageBytes = Buffer.from(imageSource.split(',')[1], 'base64');
await writeFile(path.join(output, 'assets/landscape.png'), imageBytes);
const assets = { landscape: { src: './assets/landscape.png', alt: 'Illustrative landscape supplied by the gallery', mediaType: 'image/png' } };
const imageResolver = source => source === assets.landscape.src ? imageSource : source;
const fontDiagnostics = [];
const fonts = await loadFonts({ pack: 'office', onDiagnostic: diagnostic => fontDiagnostics.push(diagnostic) });
const options = { fonts, catalogs: [gallery], text: 'paths', imageResolver, trace: true };
const corpus = { name: 'Automatic composition design audit', assets, slides: cases.map(item => item.slide) };
const sourceCorpusHash = hash(JSON.stringify(corpus));
await writeJson(path.join(output, 'auto-corpus.opf.json'), corpus);
const indexes = [];

for (const [index, example] of cases.entries()) {
  const assetSubset = example.assets ? Object.fromEntries(example.assets.map(name => [name, assets[name]])) : undefined;
  const deck = { name: example.slide.title, ...(assetSubset ? { assets: assetSubset } : {}), slides: [example.slide] };
  const source = `${JSON.stringify(deck, null, 2)}\n`;
  const validation = validate(deck, { fonts, catalogs: [gallery] });
  assert.equal(validation.valid, true, `${example.id}: ${JSON.stringify(validation.findings.filter(finding => finding.severity === 'error'))}`);
  const bound = resolvePresentation(deck, options).slides[0];
  const context = resolveSlideContext(deck, 0, { fonts, catalogs: [gallery] });
  const explained = composeSlide(context.slide, { ...context.options, fontFamilies: bound.design.fonts, textMeasurement: bound.textMeasurement, explain: true });
  const { explanation, ...geometry } = explained;
  assert.deepEqual(geometry, bound.geometry, `${example.id}: explained core geometry must equal renderer geometry`);
  assert.equal(explanation.textMeasurement, 'provided');
  const renderDiagnostics = [];
  const svg = toSvg(deck, 1, { ...options, onDiagnostic: issue => renderDiagnostics.push(issue) });
  assert.equal(hash(JSON.stringify(corpus)), sourceCorpusHash, 'Rendering must not mutate the authored corpus');
  const png = await toPng(svg, { fonts });
  await writeFile(path.join(output, `${example.id}.opf.json`), source);
  await writeFile(path.join(output, `${example.id}.svg`), svg);
  await writeFile(path.join(output, `${example.id}.png`), png);
  await writeJson(path.join(output, `${example.id}.geometry.json`), explained);
  await writeJson(path.join(output, `${example.id}.findings.json`), { validation, renderDiagnostics, contextDiagnostics: context.diagnostics });
  const record = {
    number: index + 1, id: example.id, title: example.slide.title, purpose: example.purpose,
    files: { input: `${example.id}.opf.json`, png: `${example.id}.png`, svg: `${example.id}.svg`, geometry: `${example.id}.geometry.json`, findings: `${example.id}.findings.json` },
    sha256: { input: hash(source), png: hash(png), svg: hash(svg) },
    selected: explanation.decisions.map(({ path: at, selectedColumns, mode, reason }) => ({ path: at, selectedColumns, mode, reason })),
    body: geometry.items.filter(item => !['tag', 'title', 'subtitle'].includes(item.field)).map(item => ({ path: item.path, field: item.field, box: item.box, fontSize: item.text?.fontSize, lines: item.text?.lines.length, overflow: item.text?.overflow })),
    diagnostics: geometry.diagnostics, unmeasuredPayloads: explanation.unmeasuredPayloads,
    validationCounts: validation.counts,
  };
  indexes.push(record);
  console.log(`${example.id}: ${geometry.items.length} items, ${geometry.diagnostics.length} geometry findings`);
}

const fontFiles = await Promise.all(fonts.fontFiles.map(async file => ({ file: path.relative(root, file), sha256: hash(await readFile(file)) })));
const provenance = {
  command: 'node --import ./scripts/register-local-opf.mjs scripts/design-audit-auto.mjs',
  node: process.version,
  scope: 'Current local source builds, not a registry consumer or native PowerPoint rendering.',
  source: {
    core: { revision: sourceRevision(root), version: (await readJson(path.join(root, 'packages/javascript/package.json'))).version },
    renderer: { revision: sourceRevision(path.join(root, '../opf-render')), version: (await readJson(path.join(root, '../opf-render/package.json'))).version },
    gallery: { version: (await readJson(path.join(root, 'node_modules/@openpresentation/gallery/package.json'))).version },
    principles: { file: 'docs/slide-design-principles.md', sha256: hash(await readFile(path.join(root, 'docs/slide-design-principles.md'))) },
    sourceCorpusSha256: sourceCorpusHash,
    illustration: { file: path.relative(root, imageFile), inputSha256: hash(await readFile(imageFile)), rasterSha256: hash(imageBytes) },
  },
  inputs: { noLayoutId: true, noCompositionSettings: true, noDesignOverrides: true, noDecorativeFields: true, nestedGroupsAreContentRelationships: true },
  resolvedDefaults: resolvePresentation({ slides: [cases[0].slide] }, options).slides[0].design,
  fonts: { pack: 'office', substitutionPolicy: 'metric', text: 'paths', systemFonts: false, sameHandleForMeasurementAndRaster: true, substitutions: fonts.substitutions, diagnostics: fontDiagnostics, files: fontFiles },
  limitations: ['Chart internal fit and image optical balance need visual review.', 'The gallery illustration is low resolution and duplicated in the image-pair fixture to isolate composition.', 'No native PowerPoint parity claim is made.', 'No engine, schema, catalog layout, or default was changed by this harness.'],
};
await writeJson(path.join(output, 'index.json'), { provenance, cases: indexes });
await writeFile(path.join(output, 'README.md'), `# Automatic composition audit\n\nTwenty minimally styled examples, to be reviewed in batches of three after the gallery layouts. Every slide omits layout, composition, and design overrides. Only content and meaningful groups are authored.\n\nThe exact inputs, SVG, PNG, core geometry, validation report, font hashes, default design, and local source revisions are retained. See [index.json](index.json). The engine and catalog defaults are unchanged.\n\n| No. | Example | Intended probe |\n| --- | --- | --- |\n${cases.map((item, index) => `| ${index + 1} | [${item.slide.title}](${item.id}.png) | ${item.purpose} |`).join('\n')}\n`);
console.log(`Prepared ${indexes.length} examples in ${output}`);
