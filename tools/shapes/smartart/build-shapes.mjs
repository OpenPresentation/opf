// Builds shapes.json for the Diagrams in OPF page: the 187 presets from core's own catalog and geometry (built from main in
// C:/opf-work/diagrams-page), with the default frame and adjust values from docs/shapes.md's preset table.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const core = 'C:/opf-work/diagrams-page/packages/javascript/dist/';
const { presetGeometry, presetAdjustments } = await import(pathToFileURL(`${core}shape-geometry.js`).href);
const { SHAPE_CATALOG, SHAPE_CATEGORIES, shapeThumbnailSvg } = await import(pathToFileURL(`${core}shape-catalog.js`).href);

const doc = readFileSync('C:/opf-work/diagrams-page/docs/shapes.md', 'utf8');
const table = new Map();
for (const match of doc.matchAll(/^\| `(\w+)` \| ([\d:]+) \| (.*) \|$/gm)) table.set(match[1], { frame: match[2], adjust: match[3] });

const shapes = SHAPE_CATALOG.map((entry) => {
  const row = table.get(entry.name);
  if (!row) throw new Error(`no preset table row for ${entry.name}`);
  const [fw, fh] = row.frame.split(':').map(Number);
  const scale = 64 / Math.max(fw, fh);
  const width = Math.round(fw * scale), height = Math.round(fh * scale);
  const geometry = presetGeometry(entry.name, width, height);
  const adjust = Object.entries(presetAdjustments(entry.name, width, height)).map(([name, a]) => ({ name, default: Math.round(a.default * 100000) / 100000, unit: a.unit }));
  return {
    name: entry.name, category: entry.category, keywords: entry.keywords.join(', '), frame: row.frame, adjustText: row.adjust.replace(/`/g, ''),
    adjust, sites: geometry.connectionSites.length, handles: geometry.handles.length, paths: geometry.paths.length,
    svg: shapeThumbnailSvg(geometry, width, height, { strokeWidth: 1.4 }),
  };
});
writeFileSync(new URL('shapes.json', import.meta.url), JSON.stringify({ categories: SHAPE_CATEGORIES, shapes }));
console.log(`shapes ${shapes.length}; categories ${SHAPE_CATEGORIES.length}; bytes ${JSON.stringify(shapes).length}`);
