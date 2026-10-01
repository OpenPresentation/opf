// Reading what fromPptx returns for a slide (FF-61 follow-up, 2026-10-01).
// opf-pptx 0.11.7 restores the authored form of a fresh export: a chart authored on the slide root comes back as
// `slides[N].chart`, groups come back as nested `blocks`, and promoted regions come back as their own slide fields.
// Older imports returned every content payload as a flat `slides[N].blocks[]` entry. The audits read both forms, so
// a harness check never depends on which form the importer chose.

const SKIP = new Set(['design', 'extensions', 'notes', 'chart']);

// Every chart on a restored slide, in document order: the slide's own `chart`, then every nested payload that carries
// one (blocks, groups, promoted regions), whatever the field is called.
export function restoredCharts(slide) {
  const out = [];
  const visit = (node, depth) => {
    if (!node || typeof node !== 'object' || depth > 12) return;
    if (Array.isArray(node)) { for (const item of node) visit(item, depth + 1); return; }
    if (node.chart && typeof node.chart === 'object' && typeof node.chart.type === 'string') out.push(node.chart);
    for (const [key, value] of Object.entries(node)) if (!SKIP.has(key)) visit(value, depth + 1);
  };
  visit(slide, 0);
  return out;
}
