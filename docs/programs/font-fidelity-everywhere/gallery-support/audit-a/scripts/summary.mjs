// Build SUMMARY.md from results.json (deterministic; no timestamps).
import { readFile, writeFile } from 'node:fs/promises';
const OUT = new URL('../', import.meta.url);
const { meta, summary, results } = JSON.parse(await readFile(new URL('results.json', OUT), 'utf8'));
const CLASSES = ['works', 'partial', 'schema-only', 'broken', 'gallery-only'];
const L = [];
L.push('# Dimension audit A: layouts, content blocks, image treatments, backgrounds, headers & footers', '');
L.push(`Commits: opf \`${meta.commits.opf?.slice(0, 7)}\`, opf-render \`${meta.commits['opf-render']?.slice(0, 7)}\`, opf-pptx \`${meta.commits['opf-pptx']?.slice(0, 7)}\`, pptx-gallery \`${meta.commits['pptx-gallery']?.slice(0, 7)}\`. Node ${meta.node}. Core bundled layout catalog: ${meta.coreBundledLayouts} records.`, '');
L.push(`Method: ${meta.method} Each value's OPF is the exact document the gallery page emits (lib/opf-snippets.ts). Checks: (1) core validatePresentation, (2) catalog/reference resolution, (3) opf-render SVG vs a baseline document without the dimension, (4) opf-pptx export + OPC parts + dimension-specific native XML, (5) opf-pptx fromPptx re-import, (6) docs/evidence + compatibility-matrix hits. "withAssets" re-runs values whose gallery snippet references undeclared \`asset:*\` ids with a real raster supplied.`, '');
L.push('| Dimension | Total | ' + CLASSES.join(' | ') + ' | withAssets variant | preview/export disagree |', '|---|---|' + CLASSES.map(() => '---').join('|') + '|---|---|');
for (const [d, s] of Object.entries(summary)) L.push(`| ${d} | ${s.total} | ${CLASSES.map((c) => s.counts[c] ?? 0).join(' | ')} | ${Object.entries(s.withAssetsCounts).map(([k, v]) => `${k} ${v}`).join(', ') || 'n/a'} | ${s.disagreements} |`);
L.push('');
const fontFail = results.filter((r) => r.checks?.fontRegistry && !r.checks.fontRegistry.pass);
L.push(`Font registry probe: ${fontFail.length}/${results.length} values throw \`${uniqCodes(fontFail)}\` when rendered with opf-render's \`loadOfficeFontRegistry()\` text measurement (the ecosystem-test configuration), because the default Aptos / Aptos Display scheme has no local face in that registry. All classifications below use the engine's default measurement.`, '');
function uniqCodes(rs) { return [...new Set(rs.map((r) => `${r.checks.fontRegistry.code}: ${r.checks.fontRegistry.message}`))].join('; '); }
const lenient = {};
for (const r of results) { const rest = (r.reasons ?? []).filter((s) => !/^legacy gallery slug|re-import drops layout id \(diagnostics|unresolved references: narrative/.test(s)); const k = r.dimension; (lenient[k] ??= [0, 0]); lenient[k][1]++; if (!rest.length) lenient[k][0]++; }
L.push('Sensitivity: values that would be `works` if (a) a re-import that drops the layout id but emits any diagnostic counted as a pass and (b) gallery narrative slugs absent from the core narrative catalog were ignored: ' + Object.entries(lenient).map(([k, [a, b]]) => `${k} ${a}/${b}`).join(', ') + '.', '');
for (const [d, s] of Object.entries(summary)) {
  L.push(`## ${d}`, '');
  L.push('Top reasons (count):', '');
  for (const [k, v] of Object.entries(s.reasons).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10)) L.push(`- ${v} x ${k}`);
  L.push('');
  const rs = results.filter((r) => r.dimension === d);
  if (d === 'layouts') {
    const by = {};
    for (const r of rs) { const k = `${r.origin} / master ${r.master}`; (by[k] ??= {})[r.variants.published.measuredClass ?? r.class] = ((by[k] ??= {})[r.variants.published.measuredClass ?? r.class] ?? 0) + 1; }
    L.push('Measured class by origin (gallery-only legacy slugs shown by their measured class):', '', '| Origin | ' + CLASSES.slice(0, 4).join(' | ') + ' |', '|---|---|---|---|---|');
    for (const [k, v] of Object.entries(by).sort()) L.push(`| ${k} | ${CLASSES.slice(0, 4).map((c) => v[c] ?? 0).join(' | ')} |`);
    L.push('', `Works (${rs.filter((r) => r.class === 'works').length}): ${rs.filter((r) => r.class === 'works').map((r) => r.id).join(', ') || 'none'}`, '');
  } else {
    L.push('| Value | Class | withAssets | Reasons |', '|---|---|---|---|');
    for (const r of rs) L.push(`| ${r.id} | ${r.class} | ${r.withAssetsClass ?? ''} | ${(r.reasons ?? []).join('; ').replace(/\|/g, '/')} |`);
    L.push('');
  }
  const dis = rs.filter((r) => r.previewExportDisagreement?.length);
  if (dis.length) { L.push(`Preview/export disagreements (${dis.length}):`, ''); const c = {}; for (const r of dis) for (const x of r.previewExportDisagreement) c[x] = (c[x] ?? 0) + 1; for (const [k, v] of Object.entries(c).sort((a, b) => b[1] - a[1])) L.push(`- ${v} x ${k}`); L.push(''); }
  if (rs.some((r) => r.editorPathSlugAgnostic)) L.push('Note: the gallery `/editor?config=' + d + ':<slug>` path uses the generic `buildOpfSnippet`, which emits the same design for every slug in this dimension.', '');
}
await writeFile(new URL('SUMMARY.md', OUT), L.join('\n') + '\n');
console.log('SUMMARY.md written');
