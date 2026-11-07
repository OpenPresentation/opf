// SH-12: Graphviz DOT diagrams. OPF reads DOT itself and hands the graph to pele's layered layout as a flowchart, so a DOT diagram is
// laid out, sized, painted and exported as a Mermaid flowchart is; a layout engine OPF does not draw is refused with its position.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DIAGRAM_SYNTAXES, DOT_SHAPES, checkDiagram, composeSlide, diagramPayload, diagramsPending, dotToMermaid, layoutDiagram} from '../dist/composition.js';
import {fromMarkdown, toMarkdown} from '../dist/markdown.js';
import {validate} from '../dist/index.js';

const measure = (text, size, style) => Array.from(text).length * size * (style.mono ? .6 : style.bold ? .58 : .52);
const deck = slides => ({$schema: 'https://openpresentation.org/schema/opf/v1', name: 'DOT', language: 'en-US', slides});
const mermaid = source => {
  const result = dotToMermaid(source, {maxEdges: 500});
  assert.ok(result.ok, JSON.stringify(result.issue));
  return result.translation.mermaid;
};
const issue = source => {
  const result = dotToMermaid(source, {maxEdges: 500});
  assert.equal(result.ok, false, `${source} should not translate`);
  return result.issue;
};
const PIPELINE = 'digraph pipeline {\n  rankdir=LR\n  node [shape=box]\n  Commit -> Build -> Test -> Deploy\n  Test -> Fix [label="fails", style=dashed]\n  Fix -> Build\n}';

test('DOT is a diagram syntax beside Mermaid, read from the object form only', () => {
  assert.deepEqual([...DIAGRAM_SYNTAXES], ['mermaid', 'dot']);
  assert.deepEqual(diagramPayload({source: 'digraph { a -> b }', syntax: 'dot', alt: 'A to B'}), {source: 'digraph { a -> b }', syntax: 'dot', alt: 'A to B'});
  assert.deepEqual(diagramPayload('digraph { a -> b }'), {source: 'digraph { a -> b }', syntax: 'mermaid'}, 'a string is always Mermaid');
  assert.equal(diagramPayload({source: 'x', syntax: 'plantuml-later'}), undefined);
  assert.equal(checkDiagram({source: 'x', syntax: 'graphviz'}).issue.code, 'diagram-unsupported');
});

test('a digraph becomes a pele flowchart: direction, shapes, edges, labels and clusters', () => {
  assert.equal(mermaid(PIPELINE), [
    'flowchart LR',
    '  Commit@{ shape: rect, label: "Commit" }',
    '  Build@{ shape: rect, label: "Build" }',
    '  Test@{ shape: rect, label: "Test" }',
    '  Deploy@{ shape: rect, label: "Deploy" }',
    '  Fix@{ shape: rect, label: "Fix" }',
    '  Commit --> Build',
    '  Build --> Test',
    '  Test --> Deploy',
    '  Test -.->|"fails"| Fix',
    '  Fix --> Build',
  ].join('\n'));
  // Clusters are groups (nested ones nested), with their labels; the graph's label is the title; a node is in the innermost cluster
  // that mentions it.
  const clustered = mermaid('digraph G {\n  label="Release"\n  subgraph cluster_build {\n    label="Build"\n    compile; link\n    subgraph cluster_test { label="Test"; unit }\n  }\n  compile -> link -> unit -> ship\n}');
  assert.equal(clustered, [
    '---', "title: 'Release'", '---', 'flowchart TB',
    '  ship@{ shape: stadium, label: "ship" }',
    '  subgraph c0["Build"]',
    '    compile@{ shape: stadium, label: "compile" }',
    '    link@{ shape: stadium, label: "link" }',
    '    subgraph c1["Test"]',
    '      unit@{ shape: stadium, label: "unit" }',
    '    end',
    '  end',
    '  compile --> link', '  link --> unit', '  unit --> ship',
  ].join('\n'));
  for (const [rankdir, direction] of [['TB', 'TB'], ['LR', 'LR'], ['BT', 'BT'], ['RL', 'RL'], ['lr', 'LR'], ['XY', 'TB']]) {
    assert.match(mermaid(`digraph { rankdir=${rankdir}; a -> b }`), new RegExp(`^flowchart ${direction}\\n`), rankdir);
  }
});

test('node shapes map to pele shapes, which the PPTX export writes as presets where the outline is one', () => {
  assert.equal(DOT_SHAPES.box, 'rect');
  assert.equal(DOT_SHAPES.ellipse, 'stadium', 'the default ellipse is a stadium, a rounded box that holds its label');
  assert.equal(DOT_SHAPES.diamond, 'diam');
  assert.equal(DOT_SHAPES.circle, 'circle');
  assert.equal(DOT_SHAPES.cylinder, 'cyl');
  const source = 'digraph {\n' + Object.keys(DOT_SHAPES).map((shape, index) => `  s${index} [shape=${shape}]`).join('\n') + '\n  r [shape=box, style="rounded,dashed"]\n  u [shape=star]\n}';
  const lines = mermaid(source).split('\n');
  Object.values(DOT_SHAPES).forEach((shape, index) => assert.ok(lines.includes(`  s${index}@{ shape: ${shape}, label: "${shape === 'f-circ' ? ' ' : `s${index}`}" }`), `${Object.keys(DOT_SHAPES)[index]} -> ${shape}`));
  assert.ok(lines.includes('  r@{ shape: rounded, label: "r" }'));
  assert.ok(lines.includes('  style r stroke-dasharray: 6 4'));
  assert.ok(lines.includes('  u@{ shape: rect, label: "u" }'), 'a shape with no pele form is a box');
  // Every one of them draws.
  assert.equal(checkDiagram({source, syntax: 'dot'}).ok, true);
});

test('edge styles, arrowheads, direction and length', () => {
  const edges = mermaid([
    'digraph {',
    '  a -> b',
    '  a -> c [style=dashed]', '  a -> d [style=dotted]', '  a -> e [style=bold]', '  a -> f [penwidth=3]', '  a -> g [style=invis]',
    '  a -> h [arrowhead=none]', '  a -> i [arrowhead=dot]', '  a -> j [arrowhead=odot]', '  a -> k [arrowhead=tee]', '  a -> l [arrowhead=vee]',
    '  a -> m [dir=both]', '  a -> n [dir=none]', '  a -> o [dir=back]', '  a -> p [dir=both, arrowhead=dot, arrowtail=dot]',
    '  a -> q [minlen=3]', '  a -> r [minlen=2, style=dashed]', '  a -> s [label="yes"]', '  a -> t [xlabel="side"]',
    '}',
  ].join('\n')).split('\n').filter(line => /^ {2}\w+ \S+ /.test(line));
  assert.deepEqual(edges, [
    '  a --> b', '  a -.-> c', '  a -.-> d', '  a ==> e', '  a ==> f', '  a ~~~ g',
    '  a --- h', '  a --o i', '  a --o j', '  a --x k', '  a --> l',
    '  a <--> m', '  a --- n', '  o --> a', '  a o--o p',
    '  a ----> q', '  a -..-> r', '  a -->|"yes"| s', '  a -->|"side"| t',
  ]);
  const undirected = mermaid('graph { a -- b; b -- c [dir=forward]; c -- d [style=dashed] }').split('\n').slice(-3);
  assert.deepEqual(undirected, ['  a --- b', '  b --> c', '  c -.- d']);
  // strict drops repeated edges (both ways in an undirected graph); an edge to a subgraph is an edge to each of its nodes.
  assert.deepEqual(mermaid('strict digraph { a -> b; a -> b; a -> {c d} }').split('\n').slice(-3), ['  a --> b', '  a --> c', '  a --> d']);
  assert.deepEqual(mermaid('strict graph { a -- b; b -- a; {a b} -- c }').split('\n').slice(-3), ['  a --- b', '  a --- c', '  b --- c']);
});

test('labels: escapes, records, HTML-like labels, quotes and IDs pele cannot take', () => {
  const text = mermaid([
    'digraph G {',
    '  a [label="two\\nlines\\l"]',
    '  b [label="\\N in \\G"]',
    '  c [shape=record, label="{<in> head|body\\|bar|<out> tail}"]',
    '  d [label=<<b>Bold</b><br/>and &amp; more>]',
    '  e [label="say \\"hi\\" <b> # & \\\\ end"]',
    '  "two words" -> end',
    '  end -> "日本"',
    '  e -> a [label="\\E"]',
    '  f [label="part " + "two"]',
    '}',
  ].join('\n')).split('\n');
  assert.ok(text.includes('  a@{ shape: stadium, label: "two<br>lines" }'));
  assert.ok(text.includes('  b@{ shape: stadium, label: "b in G" }'));
  assert.ok(text.includes('  c@{ shape: rect, label: "head<br>body|bar<br>tail" }'));
  assert.ok(text.includes('  d@{ shape: stadium, label: "Bold<br>and #amp; more" }'));
  assert.ok(text.includes('  e@{ shape: stadium, label: "say #quot;hi#quot; #lt;b#gt; #35; #amp; #92; end" }'));
  assert.ok(text.includes('  f@{ shape: stadium, label: "part two" }'));
  assert.ok(text.includes('  n5@{ shape: stadium, label: "two words" }'), 'an ID with a space gets a generated one');
  assert.ok(text.includes('  n6@{ shape: stadium, label: "end" }'), 'a Mermaid keyword gets a generated one');
  assert.ok(text.includes('  n7@{ shape: stadium, label: "日本" }'));
  assert.ok(text.includes('  e -->|"e-#gt;a"| a'));
  // pele reads the escaped labels back as the text DOT meant.
  const drawn = layoutDiagram({source: 'digraph { e [label="say \\"hi\\" <b> # & \\\\ end"] }', syntax: 'dot'}, {width: 900, height: 400, nominal: 24, floor: 16, measure, idPrefix: 'l'});
  assert.match(drawn.svg, /say &quot;hi&quot; &lt;b&gt; # &amp; \\ end/);
  // Comments, preprocessor lines, ports and a semicolon-free source read as Graphviz reads them.
  assert.equal(mermaid('# 1 "file.gv"\n/* header */ digraph { // edges\n  a:out:s -> b:n\n}'), 'flowchart TB\n  a@{ shape: stadium, label: "a" }\n  b@{ shape: stadium, label: "b" }\n  a --> b');
  // Invisible nodes are left out with their edges.
  assert.equal(mermaid('digraph { a -> b; h [style=invis]; a -> h }'), 'flowchart TB\n  a@{ shape: stadium, label: "a" }\n  b@{ shape: stadium, label: "b" }\n  a --> b');
});

test('what stops a DOT source is an issue at its position: syntax, layout engines OPF does not draw, table labels, limits', () => {
  assert.deepEqual(issue('digraph { a -> }'), {code: 'diagram-syntax', message: 'Expected a node ID but found "}".', line: 1, column: 16});
  assert.deepEqual(issue('graph {\n  a -> b\n}'), {code: 'diagram-syntax', message: 'An undirected graph joins nodes with "--", not "->".', line: 2, column: 5});
  assert.equal(issue('digraph { a -- b }').code, 'diagram-syntax');
  assert.equal(issue('flowchart LR\n  A --> B').code, 'diagram-syntax');
  assert.equal(issue('digraph { a "unclosed }').message, 'A quoted string is not closed.');
  assert.equal(issue('digraph {}').message, 'The graph has no nodes.');
  assert.equal(issue('digraph { a } digraph { b }').code, 'diagram-syntax');
  for (const engine of ['neato', 'fdp', 'sfdp', 'circo', 'twopi', 'osage', 'patchwork']) {
    for (const source of [`digraph {\n  layout=${engine}\n  a -> b\n}`, `digraph {\n  graph [layout=${engine}]\n  a -> b\n}`, `digraph {\n  layout="${engine}"; a -> b\n}`]) {
      const refused = issue(source);
      assert.equal(refused.code, 'diagram-unsupported', source);
      assert.equal(refused.line, 2, source);
      assert.match(refused.message, new RegExp(`the ${engine} layout is not drawn`));
    }
  }
  assert.equal(dotToMermaid('digraph { layout=dot; a -> b }', {maxEdges: 500}).ok, true, 'layout=dot is the layered layout');
  assert.equal(issue('digraph { a [label=<<table><tr><td>x</td></tr></table>>] }').code, 'diagram-unsupported');
  assert.equal(issue(`digraph { ${Array.from({length: 501}, (_, index) => `a -> b${index}`).join('; ')} }`).code, 'diagram-limit');
  assert.equal(checkDiagram({source: `digraph { a -> b }${' '.repeat(20001)}`, syntax: 'dot'}).issue.code, 'diagram-limit');
});

test('a DOT diagram lays out like a flowchart, with a Graph alt text, and nothing is pending in Node', () => {
  const value = {source: PIPELINE, syntax: 'dot'};
  assert.deepEqual(checkDiagram(value), {ok: true, type: 'flowchart'});
  const laid = layoutDiagram(value, {width: 1100, height: 420, nominal: 32, floor: 16, measure, idPrefix: 'p'});
  assert.equal(laid.type, 'flowchart');
  assert.ok(!laid.overflow);
  assert.ok(laid.fontSize >= 16);
  assert.equal(laid.alt, 'Graph: Commit, Build, Test, Deploy, Fix, fails');
  assert.equal(layoutDiagram({...value, alt: 'The pipeline'}, {width: 1100, height: 420, nominal: 32, floor: 16, measure, idPrefix: 'p'}).alt, 'The pipeline');
  // The same graph as a Mermaid flowchart draws the same picture.
  const same = layoutDiagram(mermaid(PIPELINE), {width: 1100, height: 420, nominal: 32, floor: 16, measure, idPrefix: 'p'});
  assert.equal(same.svg, laid.svg);
  assert.deepEqual(diagramsPending(deck([{diagram: value}])), []);
});

test('composition draws a DOT diagram, and validate reports a refused layout at the diagram', () => {
  const presentation = deck([{title: 'Release pipeline', diagram: {source: PIPELINE, syntax: 'dot'}}]);
  const composed = composeSlide(presentation.slides[0], {width: 1920, height: 1080, scale: 1.5});
  const item = composed.items.find(entry => entry.field === 'diagram');
  assert.equal(item.diagram.type, 'flowchart');
  assert.equal(item.diagram.issue, undefined);
  const report = validate(presentation);
  assert.equal(report.schemaValid, true);
  assert.deepEqual(report.findings.filter(finding => finding.severity === 'error'), []);
  const refused = validate(deck([{title: 'Spring', diagram: {source: 'graph {\n  layout=neato\n  a -- b\n}', syntax: 'dot'}}]));
  assert.ok(refused.findings.some(finding => finding.path === '/slides/0/diagram' && /line 2, column 3\): OPF draws DOT graphs with a layered layout/.test(finding.message)), JSON.stringify(refused.findings));
  assert.equal(validate(deck([{title: 'Unknown', diagram: {source: 'x', syntax: 'graphviz'}}])).schemaValid, false);
});

test('Markdown: a ```dot fence is a DOT diagram and writes back as one; a DOT code block stays code', () => {
  const presentation = deck([
    {title: 'Pipeline', diagram: {source: PIPELINE, syntax: 'dot'}},
    {title: 'With alt', blocks: [{text: 'Context'}, {diagram: {source: 'graph { a -- b }', syntax: 'dot', alt: 'A joins B.'}}]},
    {title: 'Code', code: {source: 'digraph { a -> b }', language: 'dot'}},
  ]);
  const {markdown, report} = toMarkdown(presentation);
  assert.equal(report.lossless, true);
  assert.ok(markdown.includes('```dot\ndigraph pipeline {'));
  assert.ok(markdown.includes('```dot alt="A joins B."\ngraph { a -- b }'));
  const back = fromMarkdown(markdown);
  assert.deepEqual(back.presentation.slides[0].diagram, {source: PIPELINE, syntax: 'dot'});
  assert.deepEqual(back.presentation.slides[1].blocks[1].diagram, {source: 'graph { a -- b }', syntax: 'dot', alt: 'A joins B.'});
  assert.deepEqual(back.presentation.slides[2].code, {source: 'digraph { a -> b }', language: 'dot'});
  const read = fromMarkdown('# Graph\n\n```dot alt="Two nodes"\ndigraph { a -> b }\n```\n');
  assert.deepEqual(read.presentation.slides[0].diagram, {source: 'digraph { a -> b }', syntax: 'dot', alt: 'Two nodes'});
  const empty = fromMarkdown('# Graph\n\n```dot\n```\n');
  assert.ok(empty.findings.some(finding => finding.ruleId === 'markdown/diagram-source' && /dot block has no source/.test(finding.message)));
  const attribute = fromMarkdown('# Graph\n\n```dot width=3\ndigraph { a }\n```\n');
  assert.ok(attribute.findings.some(finding => finding.ruleId === 'markdown/diagram-attributes'));
});
