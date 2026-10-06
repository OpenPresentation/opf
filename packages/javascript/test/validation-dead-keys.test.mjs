import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  bundlePresentation,
  colorSchemes,
  fontSchemes,
  lintPresentation,
  normalizeLanguageFamily,
  validateCatalogRecord,
  validatePresentation,
} from '../dist/index.js';
import { auditPresentation } from '../dist/audit.js';
import { resolveFontFamilies } from '../dist/composition.js';

// FA-07 (format audit): validation tightening and dead keys. Each newly invalid form is rejected and the valid
// forms still validate.
const deck = (extra = {}, slide = {}) => ({ name: 'FA-07', slides: [{ title: 'Slide', ...slide }], ...extra });
const valid = (document) => {
  const result = validatePresentation(document);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  return result;
};
const invalid = (document, ...parts) => {
  const result = validatePresentation(document);
  assert.equal(result.valid, false, 'expected the document to be invalid');
  for (const part of parts) assert.ok(result.errors.some((error) => `${error.path} ${error.message}`.includes(part)), `${part} in ${JSON.stringify(result.errors.map((e) => [e.path, e.message]))}`);
  return result;
};

describe('color-scheme slots and roles are hex colors', () => {
  const slots = ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'dark1', 'dark2', 'light1', 'light2', 'hyperlink', 'followedHyperlink'];
  const roles = ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'textSecondary'];
  test('an inline ColorScheme accepts #RGB, #RRGGBB and #RRGGBBAA and rejects everything else', () => {
    for (const key of [...slots, ...roles]) {
      for (const good of ['#fff', '#2874A6', '#0F172AFF']) valid(deck({ design: { colorScheme: { id: 'cool-horizon', [key]: good } } }));
      for (const bad of ['red', 'accent1', 'var:brand', '2874A6', '#12', '#12345']) invalid(deck({ design: { colorScheme: { id: 'cool-horizon', [key]: bad } } }), `/design/colorScheme/${key}`);
    }
  });
  test('the color-scheme record schema enforces the same pattern, and every bundled record validates', () => {
    assert.equal(colorSchemes.length, 14);
    for (const record of colorSchemes) {
      const result = validateCatalogRecord('colorSchemes', record);
      assert.equal(result.valid, true, `${record.id}: ${JSON.stringify(result.errors)}`);
    }
    const base = { $schema: 'https://openpresentation.org/schema/opf-color-scheme/v1', id: 'x', name: 'X' };
    assert.equal(validateCatalogRecord('colorSchemes', { ...base, accent1: '#2874A6' }).valid, true);
    for (const key of slots) assert.equal(validateCatalogRecord('colorSchemes', { ...base, [key]: 'blue' }).valid, false, key);
  });
  test('ColorScheme.custom is gone from the schema', async () => {
    const { schemas } = await import('../dist/schemas.js');
    assert.equal(schemas.presentation.$defs.ColorScheme.properties.custom, undefined);
    assert.doesNotMatch(schemas.presentation.$defs.ColorScheme.description, /custom/);
  });
});

describe('solid, gradient and pattern background colors are ColorRef', () => {
  const solid = (color) => deck({ design: { background: { type: 'solid', color } } });
  const stop = (color) => deck({ design: { background: { type: 'gradient', gradient: { stops: [{ color, position: 0 }, { color: '#000000', position: 1 }] } } } });
  const pattern = (key, color) => deck({ design: { background: { type: 'pattern', pattern: { preset: 'pct5', [key]: color } } } });
  test('a hex color, a scheme slot or role name and a var: reference are accepted', () => {
    for (const color of ['#0F172A', '#fff', '#0F172AFF', 'accent2', 'dark1', 'primary', 'textSecondary', 'var:brand']) {
      valid(solid(color));
      valid(stop(color));
      valid(pattern('foregroundColor', color));
      valid(pattern('backgroundColor', color));
    }
  });
  test('anything else is rejected', () => {
    for (const color of ['red', 'rgb(0,0,0)', 'Accent2', 'var:Brand', '#12', '']) {
      invalid(solid(color), '/design/background/color');
      invalid(stop(color), '/design/background/gradient/stops/0/color');
      invalid(pattern('foregroundColor', color), '/design/background/pattern/foregroundColor');
      invalid(pattern('backgroundColor', color), '/design/background/pattern/backgroundColor');
    }
  });
  test('a gradient needs at least two stops', () => {
    const gradient = (stops) => deck({ design: { background: { type: 'gradient', gradient: { angle: 90, stops } } } });
    valid(gradient([{ color: '#000000', position: 0 }, { color: '#FFFFFF', position: 1 }]));
    invalid(gradient([{ color: '#000000', position: 0 }]), '/design/background/gradient/stops');
    invalid(gradient([]), '/design/background/gradient/stops');
  });
  test('an undeclared var: reference in a background warns, a declared one does not', () => {
    const warnings = (document) => validatePresentation(document).warnings.filter((w) => w.message.includes('variable')).map((w) => w.path);
    assert.deepEqual(warnings(solid('var:brand')), ['/design/background/color']);
    assert.deepEqual(warnings(stop('var:brand')), ['/design/background/gradient/stops/0/color']);
    assert.deepEqual(warnings(pattern('backgroundColor', 'var:brand')), ['/design/background/pattern/backgroundColor']);
    assert.deepEqual(warnings({ ...solid('var:brand'), variables: { brand: '#0F4C81' } }), []);
  });
  test('the audit reads names and variables in a background like the preview', () => {
    // dark1 in the default scheme is a near-black: white text on it passes, dark text fails. Before FA-07 a name fell back to white.
    const slide = (text) => ({ title: 'Contrast', text: [{ text: 'Body copy for contrast', color: text, fontSize: 24 }] });
    const findings = (document) => auditPresentation(document, { only: ['text-contrast'] }).diagnostics.length;
    const dark = { design: { background: { type: 'solid', color: 'dark1' } } };
    assert.equal(findings({ name: 'a', language: 'en-US', ...dark, slides: [slide('#FFFFFF')] }), 0);
    assert.equal(findings({ name: 'a', language: 'en-US', ...dark, slides: [slide('#111111')] }), 1);
    const viaVariable = { design: { background: { type: 'solid', color: 'var:ink' } }, variables: { ink: '#0B1220' } };
    assert.equal(findings({ name: 'a', language: 'en-US', ...viaVariable, slides: [slide('#222222')] }), 1);
    assert.equal(findings({ name: 'a', language: 'en-US', ...viaVariable, slides: [slide('#FFFFFF')] }), 0);
  });
});

describe('TextRun.link', () => {
  const run = (link) => deck({}, { text: [{ text: 'link', link }] });
  test('http, https, mailto and tel links are accepted', () => {
    for (const link of ['http://acme.com', 'https://acme.com/a?b=c#d', 'mailto:hello@acme.com', 'tel:+15551234567']) valid(run(link));
  });
  test('relative paths, other schemes, empty and spaced links are rejected', () => {
    for (const link of ['readme.md', '/docs/a', 'ftp://acme.com', 'javascript:alert(1)', 'https://', 'https://a b', 'mailto:', '', ' https://acme.com']) invalid(run(link), '/slides/0/text/0/link');
  });
});

describe('Watermark', () => {
  const watermark = (value) => deck({ design: { watermark: value } });
  test('src is required, and so is opacity in the object form', () => {
    valid(watermark({ src: 'asset:w', opacity: 0.08 }));
    valid(watermark('asset:w'));
    valid(watermark({ src: 'asset:w', alt: 'Acme' }));
    valid(watermark(false));
    invalid(watermark({ opacity: 0.1 }));
    invalid(watermark({}));
  });
  test('the opacity range still applies', () => {
    invalid(watermark({ src: 'asset:w', opacity: 2 }));
  });
});

describe("a slide's design cannot set dimensions", () => {
  test('the deck sets dimensions, a slide does not', () => {
    valid(deck({ design: { dimensions: '4:3' } }));
    valid(deck({}, { design: { background: 'dark1', titleAlignment: 'left' } }));
    const result = invalid(deck({}, { design: { dimensions: 'a4' } }), '/slides/0/design');
    assert.ok(result.errors.some((error) => /cannot set 'dimensions'/.test(error.message)), JSON.stringify(result.errors));
    invalid(deck({}, { design: { dimensions: { preset: '16:9' } } }), '/slides/0/design');
    invalid(deck({}, { design: { dimensions: { widthInches: 10, heightInches: 5 } } }), '/slides/0/design');
  });
  test('a slide-level theme whose dimensions differ from the deck warns in validation and lint', () => {
    const catalogs = { themes: { records: [{ $schema: 'https://openpresentation.org/schema/opf-theme/v1', id: 'wide-a4', name: 'A4', dimensions: 'a4' }] } };
    const mixed = deck({ design: { theme: 'minimal' }, catalogs }, { design: { theme: 'wide-a4' } });
    const result = valid(mixed);
    const warning = result.warnings.find((issue) => issue.params.code === 'slide-theme-dimensions');
    assert.ok(warning, JSON.stringify(result.warnings));
    assert.equal(warning.path, '/slides/0/design/theme');
    const lint = lintPresentation(mixed);
    const finding = lint.diagnostics.find((entry) => entry.ruleId === 'opf/slide-theme-dimensions');
    assert.ok(finding, JSON.stringify(lint.diagnostics.map((d) => d.ruleId)));
    assert.equal(finding.severity, 'warning');
    assert.equal(finding.path, '/slides/0/design/theme');
    // The object form of a slide theme counts too.
    const objectForm = deck({ design: { theme: 'minimal' } }, { design: { theme: { id: 'minimal', dimensions: '4:3' } } });
    assert.ok(valid(objectForm).warnings.some((issue) => issue.params.code === 'slide-theme-dimensions'));
    // Same size: nothing to say. A deck-level dimensions override is reported as ignored.
    assert.equal(valid(deck({ design: { theme: 'wide-a4' }, catalogs }, { design: { theme: 'wide-a4' } })).warnings.some((issue) => issue.params.code === 'slide-theme-dimensions'), false);
    assert.equal(valid(deck({ design: { theme: 'minimal' } }, { design: { theme: 'classic' } })).warnings.some((issue) => issue.params.code === 'slide-theme-dimensions'), false);
    assert.ok(valid(deck({ design: { dimensions: '4:3' }, catalogs }, { design: { theme: 'wide-a4' } })).warnings.some((issue) => /deck's size is used/.test(issue.message)));
  });
});

describe('root audience accepts one inline Audience object', () => {
  test('a string, an object and an array validate; an object needs an id or a name', () => {
    valid(deck({ audience: 'executive' }));
    valid(deck({ audience: { id: 'executive', attentionBudgetMinutes: 20 } }));
    valid(deck({ audience: { name: 'Regional Sales Leaders', seniority: 'director' } }));
    valid(deck({ audience: [{ name: 'Regional Sales Leaders' }, 'board'] }));
    invalid(deck({ audience: { seniority: 'director' } }), '/audience');
    invalid(deck({ audience: 7 }), '/audience');
  });
  test('an object id is checked against the audiences catalog like an array entry', () => {
    const unknown = (audience) => validatePresentation(deck({ audience })).warnings.filter((w) => w.params.kind === 'audiences').map((w) => w.path);
    assert.deepEqual(unknown({ id: 'no-such-audience' }), ['/audience/id']);
    assert.deepEqual(unknown([{ id: 'no-such-audience' }]), ['/audience/0/id']);
    assert.deepEqual(unknown({ id: 'executive' }), []);
    assert.deepEqual(unknown({ name: 'Custom' }), []);
  });
  test('bundle inlines the catalog record a single audience object names', () => {
    const bundled = bundlePresentation(deck({ audience: { id: 'executive' } }));
    assert.ok(bundled.presentation.catalogs?.audiences?.records?.some((record) => record.id === 'executive'), JSON.stringify(bundled.report));
  });
});

describe('Asset.format is removed', () => {
  test('an asset object with format is rejected; mediaType says the same thing', () => {
    valid(deck({ assets: { data: { src: './data/revenue.csv', mediaType: 'text/csv' } } }));
    invalid(deck({ assets: { data: { src: './data/revenue.csv', format: 'csv' } } }), '/assets/data');
  });
});

describe('ChartDataSource is removed', () => {
  test('chart data is inline or a dataset; src, sheet and range are errors', () => {
    const chart = (data) => deck({ datasets: { r: { columns: ['Q', 'V'], rows: [['Q1', 1]] } } }, { chart: { type: 'column', data } });
    valid(chart({ columns: ['Q', 'V'], rows: [['Q1', 1]], source: { src: './revenue.csv', sheet: 'Summary', range: 'A1:B2' } }));
    valid(chart({ dataset: 'r' }));
    invalid(chart({ src: 'asset:revenue' }), '/slides/0/chart/data');
    invalid(chart({ src: './revenue.csv', sheet: 'Summary', range: 'A1:B2', columns: ['Q', 'V'] }), '/slides/0/chart/data');
    invalid(chart({ columns: ['Q', 'V'], rows: [['Q1', 1]], src: './revenue.csv' }), '/slides/0/chart/data');
  });
  test('no chart-data-source-unresolved warning exists any more', () => {
    const document = deck({}, { chart: { type: 'column', data: { src: 'asset:revenue' } } });
    assert.equal(validatePresentation(document).warnings.some((issue) => issue.params.code === 'chart-data-source-unresolved'), false);
    assert.equal(lintPresentation(document).diagnostics.some((entry) => entry.ruleId === 'opf/chart-data-source-unresolved'), false);
  });
});

describe('fonts are family-name strings', () => {
  test('heading, body, accent and code are strings; a Font object is rejected', () => {
    valid(deck({ design: { fontScheme: { id: 'aptos', heading: 'Inter', body: 'Inter', accent: 'Impact', code: 'JetBrains Mono' } } }));
    for (const role of ['heading', 'body', 'accent', 'code']) {
      invalid(deck({ design: { fontScheme: { id: 'aptos', [role]: { family: 'Inter', weight: 700 } } } }), `/design/fontScheme/${role}`);
    }
  });
  test('resolveFontFamilies reads family names only', () => {
    assert.deepEqual(resolveFontFamilies({ heading: 'Inter', body: 'Lora', code: 'JetBrains Mono', accent: 'Impact' }), { heading: 'Inter', body: 'Lora', code: 'JetBrains Mono', accent: 'Impact' });
    assert.equal(resolveFontFamilies({ code: { family: 'JetBrains Mono' } }).code, 'Roboto Mono');
    assert.equal(resolveFontFamilies({ heading: { family: 'Inter' }, major: 'Aptos Display' }).heading, 'Aptos Display');
  });
  test('the font-scheme record takes code as a string; the two monospace records carry it', () => {
    const base = { $schema: 'https://openpresentation.org/schema/opf-font-scheme/v1', id: 'team-mono', name: 'Team Mono', major: 'Inter', minor: 'Inter' };
    assert.equal(validateCatalogRecord('fontSchemes', { ...base, code: 'JetBrains Mono' }).valid, true);
    assert.equal(validateCatalogRecord('fontSchemes', { ...base, code: { family: 'JetBrains Mono' } }).valid, false);
    assert.deepEqual(fontSchemes.filter((record) => record.code !== undefined).map((record) => [record.id, record.code]).sort(), [['consolas', 'Consolas'], ['courier-new', 'Courier New']]);
  });
});

describe('FontScheme.app and languageFamily', () => {
  test('app is powerpoint or google-slides, inline and in a record', () => {
    const base = { $schema: 'https://openpresentation.org/schema/opf-font-scheme/v1', id: 'x', name: 'X', major: 'A', minor: 'B' };
    for (const app of ['powerpoint', 'google-slides']) {
      valid(deck({ design: { fontScheme: { id: 'aptos', app } } }));
      assert.equal(validateCatalogRecord('fontSchemes', { ...base, app }).valid, true, app);
    }
    for (const app of ['PowerPoint', 'Google Slides', 'googleSlides', 'keynote']) {
      invalid(deck({ design: { fontScheme: { id: 'aptos', app } } }), '/design/fontScheme/app');
      assert.equal(validateCatalogRecord('fontSchemes', { ...base, app }).valid, false, app);
    }
  });
  test('every bundled font-scheme record uses the new app values and validates', () => {
    assert.equal(fontSchemes.length, 89);
    for (const record of fontSchemes) {
      assert.ok(['powerpoint', 'google-slides'].includes(record.app), `${record.id}: ${record.app}`);
      const result = validateCatalogRecord('fontSchemes', record);
      assert.equal(result.valid, true, `${record.id}: ${JSON.stringify(result.errors)}`);
    }
  });
  test('languageFamily accepts latin, ea, cs, eastAsian and complexScript', () => {
    const base = { $schema: 'https://openpresentation.org/schema/opf-font-scheme/v1', id: 'x', name: 'X', major: 'A', minor: 'B' };
    for (const languageFamily of ['latin', 'ea', 'cs', 'eastAsian', 'complexScript']) {
      valid(deck({ design: { fontScheme: { id: 'aptos', languageFamily } } }));
      assert.equal(validateCatalogRecord('fontSchemes', { ...base, languageFamily }).valid, true, languageFamily);
    }
    for (const languageFamily of ['arabic', 'EA', 'east-asian']) invalid(deck({ design: { fontScheme: { id: 'aptos', languageFamily } } }), '/design/fontScheme/languageFamily');
  });
  test('core normalizes the long names to the short ones', () => {
    assert.deepEqual(['latin', 'ea', 'eastAsian', 'cs', 'complexScript', 'x', undefined].map(normalizeLanguageFamily), ['latin', 'ea', 'ea', 'cs', 'cs', undefined, undefined]);
  });
});

describe('descriptions state what the engines do', () => {
  test('FontScheme.code names code blocks only, and the catalog source text says engines never fetch', async () => {
    const { schemas } = await import('../dist/schemas.js');
    const defs = schemas.presentation.$defs;
    assert.match(defs.FontScheme.properties.code.description, /code blocks/);
    assert.doesNotMatch(defs.FontScheme.properties.code.description, /inline code/);
    assert.doesNotMatch(schemas.fontScheme.properties.code.description, /inline code/);
    assert.match(defs.CatalogEntry.properties.source.description, /never fetch/);
    assert.match(defs.CatalogEntry.properties.source.description, /catalogSources/);
    assert.match(defs.CatalogSource.description, /catalogSources/);
    assert.doesNotMatch(defs.CatalogSource.description, /locally-installed package/);
    assert.match(defs.Slide.properties.video.description, /placeholder/);
    assert.match(defs.Slide.properties.video.description, /Native playback is out of scope/);
    assert.match(defs.ContentPayload.properties.video.description, /placeholder/);
    assert.match(defs.Watermark.description, /fixed frame/);
    assert.equal(defs.ChartDataSource, undefined);
    assert.equal(defs.Font, undefined);
  });
});
