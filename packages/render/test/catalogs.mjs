// FA-23: the renderer is a library. It imports no catalog data, keeps no catalog lookup of its own, and passes the host's
// `catalogs` (core Catalog[]) unchanged to core resolution from every entry point; `strictReferences` maps to core's.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { defaultCatalog } from '@openpresentation/opf/catalog';
import { renderSlideSvg, renderSvg, resolvePresentation, engineDefaults, OPFRenderError } from '../dist/index.js';
import { presentationFamilies } from '../dist/fonts-browser.js';
import { ENGINE_DEFAULT_COLOR_SCHEME, ENGINE_DEFAULT_FONT_SCHEME, ENGINE_DEFAULT_THEME } from '@openpresentation/opf/composition';

let checked = 0;

// No catalog import anywhere in the shipped code: neither the source nor the built bundles name the catalog subpath.
for (const directory of ['../src/', '../dist/']) {
  const url = new URL(directory, import.meta.url);
  for (const name of readdirSync(url).filter(file => /\.(?:js|d\.ts)$/.test(file))) {
    // Code lines only: the JSDoc that tells hosts how to register a catalog may name the subpath.
    const text = readFileSync(new URL(name, url), 'utf8').split('\n').filter(line => !/^\s*(?:\*|\/\/|\/\*)/.test(line)).join('\n');
    assert.doesNotMatch(text, /(?:\bfrom\s*|\bimport\s*\(\s*)["']@openpresentation\/opf\/catalogs?["']/, `${directory}${name} imports a catalog`);
    assert.doesNotMatch(text, /catalogSources/, `${directory}${name} still reads catalogSources`);
  }
  checked++;
}
// Engine defaults are core's.
assert.equal(engineDefaults.theme, ENGINE_DEFAULT_THEME);
assert.equal(engineDefaults.colorScheme, ENGINE_DEFAULT_COLOR_SCHEME);
assert.equal(engineDefaults.fontScheme, ENGINE_DEFAULT_FONT_SCHEME);
checked++;

const slide = { title: 'Quarterly operating review', text: 'Revenue grew in every region.' };
const layoutId = Object.keys(defaultCatalog.layouts).find(id => id === 'two-column') ?? Object.keys(defaultCatalog.layouts)[0];
const deck = { name: 'Catalogs', design: { theme: 'classic' }, slides: [{ ...slide, layout: layoutId }] };

// Without catalogs the references resolve nowhere: one unresolved-reference each, engine defaults, automatic composition.
{
  const diagnostics = [];
  const svg = renderSlideSvg(deck, 0, { onDiagnostic: entry => diagnostics.push(entry) });
  assert.ok(svg.startsWith('<svg'));
  const unresolved = diagnostics.filter(entry => entry.code === 'unresolved-reference');
  assert.deepEqual(unresolved.map(entry => [entry.kind, entry.reference]).sort(), [['layouts', layoutId], ['themes', 'classic']]);
  assert.equal(resolvePresentation(deck).slides[0].layout, undefined);
  checked++;
}

// With the gallery snapshot registered the same document resolves, in every entry point.
{
  const diagnostics = [];
  const options = { catalogs: [defaultCatalog], onDiagnostic: entry => diagnostics.push(entry) };
  const one = renderSlideSvg(deck, 0, options), all = renderSvg(deck, options);
  assert.equal(all[0], one);
  assert.deepEqual(diagnostics.filter(entry => entry.code === 'unresolved-reference'), []);
  const bound = resolvePresentation(deck, { catalogs: [defaultCatalog] }).slides[0];
  assert.ok(bound.layout, 'the layout resolves from the registered catalog');
  assert.notEqual(one, renderSlideSvg(deck, 0), 'the registered catalog changes what is drawn');
  // The font loaders resolve with the same options.
  assert.ok(presentationFamilies({ ...deck, design: { fontScheme: 'roboto' } }, { catalogs: [defaultCatalog] }).has('Roboto'));
  assert.ok(!presentationFamilies({ ...deck, design: { fontScheme: 'roboto' } }).has('Roboto'));
  checked += 3;
}

// A host catalog with its own source: a named group in the document resolves against it, and only against it.
{
  const acme = { source: 'pkg:@acme/opf-catalog', fontSchemes: { serif: { name: 'Acme serif', type: 'serif', major: 'Tinos', minor: 'Tinos' } } };
  const document = { name: 'Acme', catalogs: { acme: { source: acme.source } }, design: { fontScheme: 'acme:serif' }, slides: [slide] };
  const families = svg => new Set([...svg.matchAll(/font-family="([^"]+)"/g)].map(match => match[1]));
  assert.ok(families(renderSlideSvg(document, 0, { catalogs: [acme] })).has('Tinos, serif'));
  const diagnostics = [];
  renderSlideSvg(document, 0, { onDiagnostic: entry => diagnostics.push(entry) });
  assert.deepEqual(diagnostics.filter(entry => entry.code === 'unresolved-reference').map(entry => [entry.reference, entry.source]), [['acme:serif', acme.source]]);
  // Embedded records need no host catalog.
  const embedded = { ...document, catalogs: { acme: { source: acme.source, fontSchemes: acme.fontSchemes } } };
  assert.ok(families(renderSlideSvg(embedded, 0)).has('Tinos, serif'));
  checked += 2;
}

// Strict references: the render fails with the references instead of falling back.
{
  assert.throws(() => renderSlideSvg(deck, 0, { strictReferences: true }), error => error instanceof OPFRenderError && error.code === 'unresolved-reference'
    && error.details.diagnostics.some(entry => entry.reference === 'classic'));
  assert.ok(renderSlideSvg(deck, 0, { strictReferences: true, catalogs: [defaultCatalog] }).startsWith('<svg'));
  checked++;
}
// An undeclared prefix (no catalogs.foo) is a format error: the boundary check rejects the document.
{
  assert.throws(() => renderSlideSvg({ design: { fontScheme: 'foo:serif' }, slides: [slide] }, 0, { catalogs: [defaultCatalog] }),
    error => error instanceof OPFRenderError && error.code === 'invalid-opf' && error.findings.some(finding => finding.ruleId === 'opf/undeclared-catalog' && finding.path === '/design/fontScheme'));
  checked++;
}

// A malformed catalogs option is core's error (invalid-catalogs), passed through unchanged from every entry point.
for (const bad of [{}, [{ layouts: {} }], 'https://www.pptx.gallery']) {
  for (const call of [() => renderSlideSvg(deck, 0, { catalogs: bad }), () => renderSvg(deck, { catalogs: bad }), () => resolvePresentation(deck, { catalogs: bad })]) {
    assert.throws(call, error => error.code === 'invalid-catalogs' && error.name === 'OPFCatalogsOptionError', JSON.stringify(bad));
  }
  checked++;
}

// The browser bundle of the SVG entry carries no catalog records: no layout or narrative description from the gallery snapshot.
{
  const { build } = await import('esbuild');
  const result = await build({ stdin: { contents: "export { renderSlideSvg } from './dist/svg.js';", resolveDir: new URL('../', import.meta.url).pathname, loader: 'js' }, bundle: true, platform: 'browser', format: 'esm', write: false, logLevel: 'error' });
  const code = result.outputFiles[0].text;
  const samples = [...Object.values(defaultCatalog.layouts), ...Object.values(defaultCatalog.narratives ?? {})].map(record => record.description).filter(text => typeof text === 'string' && text.length > 40).slice(0, 40);
  assert.ok(samples.length >= 10, 'enough catalog descriptions to probe');
  for (const text of samples) assert.ok(!code.includes(JSON.stringify(text).slice(1, -1)), `the renderer bundle contains catalog data (core's main entry must import none, FA-21): ${text.slice(0, 60)}`);
  checked++;
}

console.log(`catalogs: ${checked} checks passed`);
