// Builds the SmartArt research page from PowerPoint's own layout list (layouts.csv, read through COM).
import { readFileSync, writeFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const lines = readFileSync(new URL('layouts.csv', here), 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/).slice(1);
const layouts = lines.map((line) => {
  const [, , name, category, id] = line.match(/^"(\d+)","([^"]*)","([^"]*)","([^"]*)"/);
  return { name: name.trim(), category, id: id.replace('urn:microsoft.com/office/officeart/', '') };
});

const R = {
  steps: { opf: 'Process layout, numbered list, stepper (LH-168)', mermaid: 'flowchart LR (a chain)', importAs: 'Numbered list, drawn as OPF steps' },
  timeline: { opf: 'Timeline content kind', mermaid: 'timeline', importAs: 'Timeline' },
  twoLevel: { opf: 'List with descriptions, cards in a row', mermaid: 'flowchart LR (loosely)', importAs: 'List with levels' },
  pictureSteps: { opf: 'Steps with pictures', mermaid: '-', importAs: 'Steps with image blocks' },
  cycle: { opf: 'cycle arrangement (ring or loops)', mermaid: 'flowchart with a loop (looks different)', importAs: 'cycle arrangement (SH-08)' },
  org: { opf: 'Diagram (Mermaid flowchart TB)', mermaid: 'flowchart TB, treeView, mindmap', importAs: 'Mermaid flowchart TB from the outline (native shapes, SH-07)' },
  nested: { opf: 'Nested list, groups', mermaid: 'treeView', importAs: 'List with levels or groups' },
  list: { opf: 'List, cards, icon cards (LH-165), text tiles', mermaid: 'kanban (loosely)', importAs: 'List with levels or groups' },
  pictureList: { opf: 'Image blocks with captions, picture grid', mermaid: '-', importAs: 'Images with captions' },
  matrix: { opf: 'matrix arrangement (quadrants, or a card grid)', mermaid: 'quadrantChart (points on axes)', importAs: 'matrix arrangement (SH-08)' },
  team: { opf: 'Team portraits (LH-132)', mermaid: '-', importAs: 'People groups (picture and name)' },
  pyramid: { opf: 'pyramid arrangement (levels or steps)', mermaid: '-', importAs: 'pyramid arrangement (SH-08)' },
  chevrons: { opf: 'chevrons arrangement', mermaid: 'flowchart LR (a chain)', importAs: 'chevrons arrangement (SH-08)' },
  flow: { opf: 'flow arrangement', mermaid: 'flowchart LR (a chain)', importAs: 'flow arrangement (SH-08)' },
  verticalFlow: { opf: 'vertical-flow arrangement', mermaid: 'flowchart TB (a chain)', importAs: 'vertical-flow arrangement (SH-08)' },
  venn: { opf: 'Diagram (Mermaid venn)', mermaid: 'venn-beta', importAs: 'Mermaid venn from the outline' },
  radial: { opf: 'Diagram (Mermaid mindmap)', mermaid: 'mindmap', importAs: 'Mermaid mindmap from the outline' },
  compare: { opf: 'Comparison layout (two columns)', mermaid: '-', importAs: 'Comparison (two groups)' },
  equation: { opf: 'Process layout, steps', mermaid: 'flowchart LR', importAs: 'Numbered list, drawn as OPF steps' },
  shapes: { opf: 'Gap: decorative arrangement', mermaid: '-', importAs: 'Drawing kept as shapes (SH-05 overlays), outline in notes', gap: true },
  card: { opf: 'Cards, text tiles, quote cards (LH-165, LH-78)', mermaid: '-', importAs: 'Cards or tiles' },
  architecture: { opf: 'Diagram (Mermaid block or architecture)', mermaid: 'block, architecture-beta', importAs: 'Mermaid block from the outline' },
};

// The OPF diagram each rule lands on (the page's OPF diagrams tab).
const GENERIC = { steps: 'process', timeline: 'timeline', twoLevel: 'list', pictureSteps: 'process', cycle: 'cycle', org: 'diagram', nested: 'list', list: 'list', pictureList: 'gallery', matrix: 'matrix', team: 'team', pyramid: 'pyramid', chevrons: 'chevrons', flow: 'flow', verticalFlow: 'vertical-flow', venn: 'diagram', radial: 'diagram', compare: 'comparison', equation: 'process', shapes: 'shapes', card: 'list', architecture: 'diagram' };
for (const [key, value] of Object.entries(R)) value.generic = GENERIC[key];

function rule({ name, category }) {
  const has = (...words) => words.some((word) => name.includes(word));
  switch (category) {
    case 'timeline': return R.timeline;
    case 'meettheteam': return R.team;
    case 'textcard': return R.card;
    case 'picture': return R.pictureList;
    case 'pyramid': return R.pyramid;
    case 'matrix': return R.matrix;
    case 'cycle': return name === 'Radial Cycle' ? R.radial : R.cycle;
    case 'hierarchy':
      if (name === 'Architecture Layout') return R.architecture;
      if (has('Organization Chart', 'Picture Hierarchy') || ['Hierarchy', 'Horizontal Hierarchy', 'Horizontal Multi-Level Hierarchy'].includes(name)) return R.org;
      return R.nested;
    case 'list':
      if (has('Picture', 'Pictures')) return R.pictureList;
      return R.list;
    case 'process':
      if (name === 'Basic Chevron Process') return R.chevrons;
      if (name === 'Basic Process') return R.flow;
      if (name === 'Vertical Process') return R.verticalFlow;
      if (has('Timeline')) return R.timeline;
      if (has('Picture')) return R.pictureSteps;
      if (has('Random to Result', 'Converging Text', 'Interconnected Block')) return R.shapes;
      if (['Alternating Flow', 'Process List', 'Chevron List', 'Sub-Step Process', 'Segmented Process', 'Detailed Process', 'Phased Process', 'Vertical Arrow List', 'Vertical Chevron List', 'Staggered Process'].includes(name)) return R.twoLevel;
      return R.steps;
    case 'relationship':
      if (has('Venn')) return R.venn;
      if (has('Radial', 'Circle Relationship')) return R.radial;
      if (['Balance', 'Plus and Minus', 'Opposing Ideas', 'Reverse List', 'Counterbalance Arrows', 'Opposing Arrows'].includes(name)) return R.compare;
      if (has('Equation')) return R.equation;
      return R.shapes;
    default: return R.shapes;
  }
}

// The built-in layouts OPF writes as live SmartArt (SH-09, SH-17, SH-18), by the arrangement that writes them.
const LIVE = { 'Basic Pyramid': 'pyramid', 'Basic Matrix': 'matrix', 'Basic Cycle': 'cycle', 'Basic Chevron Process': 'chevrons', 'Basic Process': 'flow', 'Vertical Process': 'vertical-flow' };

const rows = layouts.map((layout) => {
  const r = rule(layout);
  return { ...layout, opf: r.opf, mermaid: r.mermaid, importAs: r.importAs, gap: Boolean(r.gap), generic: r.generic, live: LIVE[layout.name] || '' };
});
const missing = Object.keys(LIVE).filter((name) => !rows.some((row) => row.name === name));
if (missing.length) throw new Error(`live layouts not in layouts.csv: ${missing.join(', ')}`);

const template = readFileSync(new URL('page.html', here), 'utf8');
const { categories: shapeCategories, shapes } = JSON.parse(readFileSync(new URL('shapes.json', here), 'utf8'));
const out = template.replace('/*DATA*/null', JSON.stringify({ rows, shapes, shapeCategories }));
writeFileSync(new URL('smartart-research.html', here), out);
console.log(`rows ${rows.length}; gaps ${rows.filter((row) => row.gap).length}`);
