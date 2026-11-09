// SH-12: the preview draws a Graphviz DOT diagram as core lays it out (pele's layered layout of OPF's reading of the graph): the same
// picture as the flowchart it becomes, named as a graph, and the "Diagram unavailable" placeholder for a layout OPF does not draw.
import assert from 'node:assert/strict';
import { dotToMermaid } from '@openpresentation/opf/composition';
import { toSvg } from './catalog-harness.mjs';

const deck = slides => ({ language: 'en-US', design: { fontScheme: 'roboto', colorScheme: 'corporate-blue' }, slides });
const dot = 'digraph {\n  rankdir=LR\n  node [shape=box]\n  Brief -> Approved\n  Approved [shape=diamond, label="Approved?"]\n  Approved -> Build [label="yes"]\n  Approved -> Brief [label="no", style=dashed]\n}';

{
  const svg = toSvg(deck([{ title: 'Flow', diagram: { source: dot, syntax: 'dot' } }]), 1);
  assert.match(svg, /<g aria-label="Graph: Brief, Approved\?, Build, yes, no" data-opf-diagram="flowchart" role="img">/);
  const group = svg.slice(svg.indexOf('data-opf-diagram="flowchart"'));
  for (const label of ['Brief', 'Approved?', 'Build', 'yes', 'no']) assert.ok(group.includes(`>${label}<`), `label ${label} is text`);
  for (const leftover of ['var(--', 'color-mix', 'class="pele']) assert.ok(!svg.includes(leftover), `no ${leftover}`);
  // The drawing is the one of the flowchart OPF reads the graph as (only the alt text differs).
  const translated = dotToMermaid(dot, { maxEdges: 500 });
  assert.ok(translated.ok);
  const flow = toSvg(deck([{ title: 'Flow', diagram: translated.translation.mermaid }]), 1);
  assert.equal(svg.replace(/aria-label="[^"]*"/g, ''), flow.replace(/aria-label="[^"]*"/g, ''));
}

{
  const svg = toSvg(deck([{ title: 'Spring', diagram: { source: 'graph {\n  layout=neato\n  a -- b\n}', syntax: 'dot' } }]), 1);
  assert.match(svg, /Diagram unavailable/);
}

console.log('SH-12 preview: DOT diagrams draw as their flowchart, a refused layout as the placeholder');
