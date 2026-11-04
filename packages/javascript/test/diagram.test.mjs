// Diagram payloads: Mermaid source laid out by pele in the host's measured fonts and painted in the slide's resolved colors.
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {DIAGRAM_SECONDARY_FLOOR,checkDiagram,colorContrast,composeSlide,diagramPalette,diagramPayload,layoutDiagram,paintDiagram,paintDiagramGroup} from '../dist/composition.js';
import {fromMarkdown,toMarkdown} from '../dist/markdown.js';
import {validate} from '../dist/index.js';

const measure = (text, size, style) => Array.from(text).length * size * (style.mono ? .6 : style.bold ? .58 : .52);
const deck = (slides, design = {}) => ({ $schema: 'https://openpresentation.org/schema/opf/v1', name: 'Diagrams', language: 'en-US', design, slides });
const inside = (inner, outer) => inner.x >= outer.x - .01 && inner.y >= outer.y - .01 && inner.x + inner.width <= outer.x + outer.width + .01 && inner.y + inner.height <= outer.y + outer.height + .01;

// One source per family, as authors write them.
const FAMILIES = {
  flowchart: 'flowchart LR\n  A[Brief] --> B{Approved?}\n  B -->|yes| C[Build]\n  B -->|no| A',
  sequence: 'sequenceDiagram\n  Client->>API: POST /decks\n  API-->>Client: 201 Created',
  class: 'classDiagram\n  class Deck {\n    +String name\n    +render()\n  }\n  Deck --> Slide',
  state: 'stateDiagram-v2\n  [*] --> Draft\n  Draft --> Review\n  Review --> [*]',
  er: 'erDiagram\n  DECK ||--o{ SLIDE : contains\n  SLIDE { string title }',
  gantt: 'gantt\n  dateFormat YYYY-MM-DD\n  section Build\n  Design :a1, 2026-01-01, 20d\n  Develop :after a1, 30d',
  pie: 'pie title Revenue mix\n  "Subscriptions" : 62\n  "Services" : 38',
  mindmap: 'mindmap\n  root((Strategy))\n    Growth\n    Efficiency',
  timeline: 'timeline\n  2025 : Research\n  2026 : Beta : GA',
  journey: 'journey\n  title Onboarding\n  section Sign up\n    Create account: 3: Visitor',
  quadrantChart: 'quadrantChart\n  x-axis Low --> High\n  y-axis Low --> High\n  Campaign A: [0.3, 0.6]',
  xychart: 'xychart-beta\n  x-axis [jan, feb, mar]\n  bar [20, 45, 60]',
  sankey: 'sankey-beta\nVisits,Signups,40\nSignups,Paid,12',
  gitGraph: 'gitGraph\n  commit\n  branch feature\n  commit\n  checkout main\n  merge feature',
  c4: 'C4Context\n  Person(u, "Presenter")\n  System(s, "OPF")\n  Rel(u, s, "Authors")',
  block: 'block-beta\n  columns 2\n  a["Plan"] b["Ship"]',
  architecture: 'architecture-beta\n  service api(server)[API]\n  service db(database)[DB]\n  api:R -- L:db',
  kanban: 'kanban\n  todo[To do]\n    t1[Write brief]\n  done[Done]\n    t2[Outline]',
  venn: 'venn-beta\n  set A["Design"]\n  set B["Engineering"]\n  union A,B["Product"]',
  ishikawa: 'ishikawa\n  Late launch\n    People\n      Hiring gap',
};

test('checkDiagram names the family of every supported source and locates syntax errors', () => {
  for (const [family, source] of Object.entries(FAMILIES)) {
    const result = checkDiagram(source);
    assert.equal(result.ok, true, family);
    assert.equal(result.type, family);
    assert.deepEqual(checkDiagram({ source, alt: 'x' }), result);
  }
  const broken = checkDiagram('flowchart LR\n  A --> [oops');
  assert.equal(broken.ok, false);
  assert.equal(broken.issue.code, 'diagram-syntax');
  assert.deepEqual([broken.issue.line, broken.issue.column], [2, 9]);
  assert.match(broken.issue.message, /Expecting/);
  assert.equal(checkDiagram('just words').issue.code, 'diagram-unsupported');
  assert.equal(checkDiagram('   ').issue.code, 'diagram-empty');
  assert.equal(checkDiagram({ alt: 'no source' }).issue.code, 'diagram-empty');
  assert.equal(checkDiagram('flowchart LR\n' + 'A-->B\n'.repeat(4000)).issue.code, 'diagram-limit');
});

test('diagramPayload reads the string shorthand and the object form', () => {
  assert.deepEqual(diagramPayload('pie\n "A" : 1'), { source: 'pie\n "A" : 1', syntax: 'mermaid' });
  assert.deepEqual(diagramPayload({ source: 'x', alt: 'Shows x' }), { source: 'x', syntax: 'mermaid', alt: 'Shows x' });
  assert.deepEqual(diagramPayload({ source: 'x', alt: '  ' }), { source: 'x', syntax: 'mermaid' });
  assert.equal(diagramPayload(42), undefined);
  assert.equal(diagramPayload({ source: 3 }), undefined);
});

test('layoutDiagram draws the largest size that fits, never under the floors, and is deterministic', () => {
  const options = { width: 1600, height: 700, nominal: 48, floor: 24, measure, idPrefix: 'd' };
  for (const [family, source] of Object.entries(FAMILIES)) {
    const laid = layoutDiagram(source, options);
    assert.deepEqual(layoutDiagram(source, options), laid, family);
    assert.ok(laid.width * laid.scale <= options.width + .5 && laid.height * laid.scale <= options.height + .5, family);
    assert.ok(laid.fontSize <= options.nominal + 1e-9, family);
    if (!laid.overflow) {
      assert.ok(laid.fontSize >= options.floor - 1e-9, family);
      assert.ok(laid.smallestText >= options.floor * DIAGRAM_SECONDARY_FLOOR - 1e-6, family);
    }
    assert.ok(laid.alt.length > 0 && laid.alt.length <= 400, family);
  }
  // A small diagram with room grows to the nominal size; a dense one in a small area overflows at the floor.
  assert.equal(layoutDiagram('flowchart LR\n  A --> B', options).fontSize, 48);
  const dense = 'flowchart TB\n' + Array.from({ length: 30 }, (_, i) => `  n${i}[Step ${i}] --> n${i + 1}[Step ${i + 1}]`).join('\n');
  const squeezed = layoutDiagram(dense, { ...options, width: 400, height: 300 });
  assert.equal(squeezed.overflow, true);
  assert.ok(squeezed.width * squeezed.scale <= 400.5 && squeezed.height * squeezed.scale <= 300.5);
  assert.throws(() => layoutDiagram('flowchart LR\n  A --> [', options), error => error.diagramIssue?.code === 'diagram-syntax');
});

test('the default alt names the family and its labels; an authored alt wins', () => {
  const options = { width: 1200, height: 600, nominal: 32, floor: 16, measure, idPrefix: 'd' };
  assert.equal(layoutDiagram(FAMILIES.flowchart, options).alt, 'Flowchart: Brief, Approved?, Build, yes, no');
  assert.equal(layoutDiagram({ source: FAMILIES.flowchart, alt: 'Briefs are approved before they are built.' }, options).alt, 'Briefs are approved before they are built.');
});

test('diagramPalette keeps text, lines and outlines readable on light and dark surfaces and follows the variant accents', () => {
  const colorScheme = { accent1: '#1F6FEB', accent2: '#D97706', accent3: '#059669', accent4: '#DC2626', accent5: '#7C3AED', accent6: '#0891B2', dark1: '#111827', light1: '#FFFFFF' };
  for (const [surface, text] of [['#FFFFFF', '#111827'], ['#0B1020', '#F9FAFB'], ['#F3EFE6', '#2B2B2B']]) {
    const palette = diagramPalette({ surface, text, colorScheme, fonts: { body: 'Aptos', code: 'Roboto Mono' } });
    for (const fill of [palette.background, palette.surface, palette.surfaceAlt]) assert.ok(colorContrast(palette.text, fill) >= 4.5, `${surface} text on ${fill}`);
    assert.ok(colorContrast(palette.muted, surface) >= 4.5);
    assert.ok(colorContrast(palette.line, surface) >= 3);
    assert.ok(colorContrast(palette.border, surface) >= 1.8);
    assert.equal(palette.series.length, 8);
    assert.equal(palette.background, surface);
  }
  const dark = diagramPalette({ surface: '#0B1020', text: '#F9FAFB', colorScheme, fonts: { body: 'Aptos', code: 'Roboto Mono' } });
  assert.ok(colorContrast(dark.surface, '#000000') < colorContrast(dark.surface, '#FFFFFF'), 'a dark surface gives dark node fills');
  // RR-96: the variant's accent order decides series 1.
  const reordered = diagramPalette({ surface: '#FFFFFF', text: '#111827', colorScheme, context: { accents: ['accent3', 'accent1', 'accent2', 'accent4', 'accent5', 'accent6'] }, fonts: { body: 'Aptos', code: 'Roboto Mono' } });
  assert.equal(reordered.series[0], '#059669');
});

test('paintDiagram resolves every variable into a self-contained SVG in the palette', () => {
  const palette = diagramPalette({ surface: '#FFFFFF', text: '#111827', colorScheme: { accent1: '#1F6FEB' }, fonts: { body: 'Open Sans', code: 'Roboto Mono' } });
  const options = { width: 1200, height: 600, nominal: 32, floor: 16, measure, idPrefix: 'd' };
  for (const [family, source] of Object.entries({ ...FAMILIES, escaped: 'flowchart LR\n  A["R&D <core>"] --> B["Ship \\"it\\""]' })) {
    const laid = layoutDiagram(source, options);
    const svg = paintDiagram(laid, palette, { width: 600, height: 300 });
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 [\d.]+ [\d.]+" width="600" height="300" font-family="'Open Sans', sans-serif"/, family);
    for (const leftover of ['var(', 'color-mix', 'class=', 'style=', 'currentColor', 'aria-']) assert.ok(!svg.includes(leftover), `${family}: ${leftover}`);
    assert.equal((svg.match(/<text\b/g) ?? []).length, (svg.match(/<\/text>/g) ?? []).length, family);
    const group = paintDiagramGroup(laid, palette, { x: 10, y: 20, width: 600, height: 300 });
    assert.match(group, /^<g transform="translate\(10 20\) scale\([\d.]+\)" font-family=/, family);
    assert.ok(!group.includes('var('), family);
  }
  const svg = paintDiagram(layoutDiagram('flowchart LR\n  A["R&D <core>"] --> B', options), palette, { width: 600, height: 300 });
  assert.ok(svg.includes('R&amp;D &lt;core&gt;'));
  assert.ok(svg.includes(`fill="${palette.surface}"`) && svg.includes(`stroke="${palette.border}"`));
});

test('composition places a diagram inside its block, centered, and reports sources it cannot draw', () => {
  const slide = { title: 'Flow', diagram: FAMILIES.flowchart };
  const geometry = composeSlide(slide, { width: 1920, height: 1080, scale: 1.5, textMeasurement: { measure: (text, size) => Array.from(text).length * size * .52 } });
  const item = geometry.items.find(entry => entry.field === 'diagram');
  assert.ok(item?.diagram?.svg);
  assert.ok(inside(item.diagram.box, item.box));
  assert.ok(Math.abs(item.diagram.box.x + item.diagram.box.width / 2 - (item.box.x + item.box.width / 2)) < 1);
  assert.ok(item.diagram.fontSize >= 24 - 1e-9);
  const broken = composeSlide({ title: 'Broken', diagram: 'flowchart LR\n  A --> [' }, { width: 1920, height: 1080, scale: 1.5 });
  const issue = broken.items.find(entry => entry.field === 'diagram');
  assert.equal(issue.diagram.issue.code, 'diagram-syntax');
  assert.ok(broken.diagnostics.some(entry => entry.code === 'unresolved-content' && /line 2, column/.test(entry.message)));
});

test('validation accepts diagrams in every position and reports their syntax errors with a position', () => {
  const valid = deck([
    { title: 'Root', diagram: FAMILIES.flowchart },
    { title: 'Typed', type: 'diagram', diagram: { source: FAMILIES.sequence, alt: 'The client creates a deck.' }, caption: 'Every write is acknowledged.' },
    { title: 'Blocks', blocks: [{ text: 'Context' }, { diagram: FAMILIES.mindmap }, { type: 'group', blocks: [{ diagram: FAMILIES.pie }] }] },
  ]);
  const report = validate(valid);
  assert.equal(report.schemaValid, true, JSON.stringify(report.findings.filter(f => f.severity === 'error')));
  assert.deepEqual(report.findings.filter(f => f.severity === 'error'), []);
  const invalid = validate(deck([{ title: 'Typed', type: 'diagram', text: 'no source' }, { title: 'Extra', diagram: { source: 'pie\n "A" : 1', theme: 'dark' } }, { title: 'Empty', diagram: { source: '' } }]));
  assert.equal(invalid.schemaValid, false);
  const broken = validate(deck([{ title: 'Broken', diagram: 'flowchart LR\n  A --> [' }]));
  assert.ok(broken.findings.some(f => f.path === '/slides/0/diagram' && /line 2, column 9/.test(f.message)));
});

test('Markdown writes diagrams as mermaid fences and reads them back', () => {
  const presentation = deck([
    { title: 'Flow', diagram: FAMILIES.flowchart },
    { title: 'With alt', blocks: [{ text: 'Context' }, { diagram: { source: FAMILIES.sequence, alt: 'The client "creates" a deck.' } }] },
  ]);
  const { markdown, report } = toMarkdown(presentation);
  assert.equal(report.lossless, true);
  assert.ok(markdown.includes('```mermaid\nflowchart LR'));
  assert.ok(markdown.includes('```mermaid alt="The client \\"creates\\" a deck."\nsequenceDiagram'));
  const back = fromMarkdown(markdown);
  assert.deepEqual(back.presentation.slides.map(slide => slide.diagram ?? slide.blocks?.[1]?.diagram), [FAMILIES.flowchart, { source: FAMILIES.sequence, alt: 'The client "creates" a deck.' }]);
  // A code block in the Mermaid language stays code: it is embedded, so it does not read back as a diagram.
  const code = toMarkdown(deck([{ title: 'Code', code: { source: 'graph LR', language: 'mermaid' } }]));
  assert.equal(fromMarkdown(code.markdown).presentation.slides[0].code.language, 'mermaid');
  // A source with backticks gets a longer fence.
  const ticks = toMarkdown(deck([{ title: 'Ticks', diagram: 'flowchart LR\n  A["```"] --> B' }]));
  assert.equal(fromMarkdown(ticks.markdown).presentation.slides[0].diagram, 'flowchart LR\n  A["```"] --> B');
});

test('in a browser bundle the engine loads each diagram type on demand, and a type still loading is no finding', () => {
  const run = spawnSync(process.execPath, ['--conditions=browser', fileURLToPath(new URL('./diagram-browser-engine.mjs', import.meta.url))], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /lazy diagram engine: ok/);
});
