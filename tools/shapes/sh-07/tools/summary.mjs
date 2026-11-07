// node summary.mjs: the per-family summary of the shapes comparison (../summary.md and ../summary.json) and the sheets in ../sheets.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const { unzipSync, strFromU8 } = createRequire('C:/opf-work/sh-07-native-diagrams/packages/pptx/package.json')('fflate');
const root = process.env.SH07_ROOT ?? 'C:/opf-work/shapes/sh-07';
const scores = JSON.parse(readFileSync(`${root}/shapes/scores.json`, 'utf8'));
const geometry = new Map(JSON.parse(readFileSync(`${root}/shapes/geometry.json`, 'utf8')).map((row) => [row.id, row]));
const text = new Map(JSON.parse(readFileSync(`${root}/shapes/textpos.json`, 'utf8')).map((row) => [row.id, row]));
const picture = new Map(JSON.parse(readFileSync(`${root}/picture/scores.json`, 'utf8')).map((row) => [row.id, row]));
const LIMIT = { hot: 0.5, hot1280: 0.5, mad: 1.0, mad1280: 2.0, text: 1.5 };
const CLEAN = ['agentflow', 'block', 'flowchart', 'railroad', 'treeview', 'usecase'];
const NAMES = { flowchart: 'Flowchart', sequence: 'Sequence', class: 'Class', state: 'State', er: 'Entity relationship', gantt: 'Gantt', pie: 'Pie', quadrant: 'Quadrant', mindmap: 'Mind map', timeline: 'Timeline', journey: 'User journey', xychart: 'XY chart', sankey: 'Sankey', gitgraph: 'Git graph', c4: 'C4', block: 'Block', architecture: 'Architecture', kanban: 'Kanban', packet: 'Packet', radar: 'Radar', treemap: 'Treemap', venn: 'Venn', ishikawa: 'Ishikawa', requirement: 'Requirement', wardley: 'Wardley map', treeview: 'Tree view', eventmodeling: 'Event modeling', railroad: 'Railroad', cynefin: 'Cynefin', usecase: 'Use case', swimlane: 'Swimlane', agentflow: 'Agent flow' };
mkdirSync(`${root}/sheets`, { recursive: true });
for (const file of readdirSync(`${root}/shapes/sheets`)) copyFileSync(`${root}/shapes/sheets/${file}`, `${root}/sheets/${file}`);
const families = [];
for (const [family, name] of Object.entries(NAMES)) {
  const rows = scores.filter((row) => row.family === family);
  const max = (key) => Math.max(...rows.map((row) => row[key]));
  let shapes = 0, connectors = 0, bound = 0, presets = 0, custom = 0, texts = 0;
  for (const row of rows) {
    const xml = strFromU8(unzipSync(readFileSync(`${root}/shapes/pptx/${row.id}.pptx`))['ppt/slides/slide1.xml']);
    const group = /<p:grpSp>[\s\S]*<\/p:grpSp>/.exec(xml)?.[0] ?? '';
    shapes += (group.match(/<p:sp>/g) ?? []).length; connectors += (group.match(/<p:cxnSp>/g) ?? []).length; bound += (group.match(/<a:(stCxn|endCxn) /g) ?? []).length;
    presets += (group.match(/<a:prstGeom prst="(?!rect")/g) ?? []).length; custom += (group.match(/<a:custGeom>/g) ?? []).length; texts += (group.match(/<a:t>/g) ?? []).length;
  }
  const entry = {
    family, name, sources: rows.map((row) => row.id), mad: max('mad'), hot: max('hot'), mad1280: max('mad1280'), hot1280: max('hot1280'),
    pictureMad: Math.max(...rows.map((row) => picture.get(row.id)?.mad ?? 0)),
    geometryMad: Math.max(...rows.map((row) => geometry.get(row.id).geometryMad)), geometryHot: Math.max(...rows.map((row) => geometry.get(row.id).geometryHot)),
    textDy: Math.max(...rows.map((row) => Math.abs(text.get(row.id).dyMedian))), textDx: Math.max(...rows.map((row) => Math.abs(text.get(row.id).dxMedian))),
    shapes, connectors, bound, presets, custom, texts, clean: CLEAN.includes(family),
  };
  entry.pass = entry.hot <= LIMIT.hot && entry.hot1280 <= LIMIT.hot1280 && entry.mad <= LIMIT.mad && entry.mad1280 <= LIMIT.mad1280 && entry.textDy <= LIMIT.text && entry.textDx <= LIMIT.text;
  families.push(entry);
}
const clean = families.filter((entry) => entry.clean);
const cleanMax = { mad: Math.max(...clean.map((e) => e.mad)), mad1280: Math.max(...clean.map((e) => e.mad1280)), hot: Math.max(...clean.map((e) => e.hot)), text: Math.max(...clean.map((e) => Math.max(e.textDy, e.textDx))) };
const lines = [
  '# SH-07: native diagrams, PowerPoint against the preview',
  '',
  `Corpus: ${scores.length} sources, two per family (the docs' or tests' example and a harder one), the diagram alone on a 1280 x 720 slide of the default design. Preview: core convert to PNG (opf-render). PowerPoint: the PPTX exported with diagrams: "shapes", opened read-only through COM in PowerPoint 365 for Windows and exported at 1280 x 720.`,
  '',
  'Metrics (as harvest/wave8/verify/w8/tools/pairs.mjs): mad = mean absolute difference per channel at 320 x 180; hot = share of 8 x 8 blocks whose mean differs by more than 24/255. Also at 1280 x 720 (16 x 16 blocks), the geometry mad outside every text body (tools/geom.mjs), and the median offset of each text\'s ink in pixels at 1280 (tools/textpos.mjs).',
  '',
  `Threshold, set from the clean families (${CLEAN.join(', ')}: few labels, so their difference is the renderers' antialiasing; worst mad ${cleanMax.mad}, mad at 1280 ${cleanMax.mad1280}, hot ${cleanMax.hot} %, text offset ${cleanMax.text} px): every source of a family has hot <= ${LIMIT.hot} % at both sizes, mad <= ${LIMIT.mad} (320) and <= ${LIMIT.mad1280} (1280), and median text offsets <= ${LIMIT.text} px; and the visual check of its sheet shows nothing beyond antialiasing and the glyphs of the preview's stand-in for Aptos (Intos). The mad limits are a little over twice the clean families' worst, for line-dense drawings (sub-pixel line placement) and text-heavy ones (glyph shapes of the stand-in font).`,
  '',
  '| Family | Sources | mad (320) | hot | mad (1280) | hot (1280) | geometry mad | text dy / dx (px) | picture-path mad | shapes / connectors (glued ends) / presets / freeforms | Result |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...families.map((e) => `| ${e.name} | ${e.sources.join(', ')} | ${e.mad} | ${e.hot} % | ${e.mad1280} | ${e.hot1280} % | ${e.geometryMad} | ${e.textDy} / ${e.textDx} | ${e.pictureMad} | ${e.shapes} / ${e.connectors} (${e.bound}) / ${e.presets} / ${e.custom} | ${e.pass ? 'pass' : 'FAIL'} |`),
  '',
  `Passed: ${families.filter((e) => e.pass).length} of ${families.length}. Sheets (preview | PowerPoint | difference x4): sheets/<family>.png.`,
];
writeFileSync(`${root}/summary.md`, lines.join('\n') + '\n');
writeFileSync(`${root}/summary.json`, JSON.stringify({ limit: LIMIT, clean: cleanMax, families }, null, 1));
console.log(lines.slice(-38).join('\n'));
