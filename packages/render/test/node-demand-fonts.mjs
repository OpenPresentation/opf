import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { create } from 'fontkit';
import {
  loadFonts,
  BUNDLED_FONT_MANIFEST,
  autoScriptSelection,
} from '../dist/fonts-node.js';
import { FONT_SELECTION_METADATA } from '../dist/font-selection-metadata.js';
import { selectionFamilyGroup } from '../dist/font-selection.js';
import { createFontRegistry, pickFace } from '../dist/font-registry.js';
import { toSvg, catalogs } from './catalog-harness.mjs';
const renderOptions = { catalogs },
  options = { pack: 'office', substitutionPolicy: 'visual' },
  request = (presentation) => ({
    ...options,
    scripts: 'auto',
    presentation,
    renderOptions,
  });
const simple = { slides: [{ title: 'A title', text: 'A body' }] },
  three = {
    slides: [
      {
        title: 'Measured table',
        table: {
          columns: ['Product', 'Value'],
          rows: [
            ['First', 12],
            ['Second', 24],
          ],
        },
      },
    ],
  };
const descriptor = (face) => [
  face.family,
  face.familyGroup ?? face.family,
  face.weight,
  face.italic,
];
let eager;
const full = () => (eager ??= loadFonts(options));

test('presentation demand holds only the two/three actual default faces; no-presentation whole pack stays explicit', async () => {
  const baseline = await full();
  assert.ok(baseline.fontFiles.length > 100);
  for (const [doc, count] of [
    [simple, 2],
    [three, 3],
  ]) {
    const fonts = await loadFonts(request(doc));
    assert.equal(fonts.fontFiles.length, count);
    assert.equal(fonts.registry.describeFaces().length, count);
    assert.deepEqual(fonts.pending(doc, renderOptions), []);
    for (const text of ['system', 'fonts', 'paths'])
      assert.equal(
        toSvg(doc, 1, { ...renderOptions, fonts, text }),
        toSvg(doc, 1, { ...renderOptions, fonts: baseline, text }),
        text,
      );
  }
});

test('neutral and valid no-text documents need zero faces without weakening default empty-registry refusal', async () => {
  assert.throws(() => createFontRegistry([]), { code: 'empty-font-registry' });
  await assert.rejects(loadFonts({ pack: 'none' }), {
    code: 'empty-font-registry',
  });
  for (const doc of [{ slides: [] }, { slides: [{}] }]) {
    const fonts = await loadFonts(request(doc));
    assert.equal(fonts.fontFiles.length, 0);
    assert.deepEqual(fonts.embeddedFonts, []);
    assert.deepEqual(fonts.pending(doc, renderOptions), []);
    assert.deepEqual((await fonts.ensure(doc, { renderOptions })).lazy, []);
  }
});

test('edits add only missing bold/italic and family faces; concurrent ensure is serialized and duplicate-free', async () => {
  const fonts = await loadFonts(request(simple)),
    edited = {
      slides: [
        {
          title: 'A title',
          text: [
            'Plain ',
            { text: 'bold', bold: true },
            ' ',
            { text: 'italic', italic: true },
          ],
        },
      ],
    },
    other = {
      design: { fontScheme: 'open-sans' },
      slides: [{ title: 'Another face', text: 'Body' }],
    };
  assert.equal(fonts.pending(edited, renderOptions).length, 2);
  const results = await Promise.all([
    fonts.ensure(edited, { renderOptions }),
    fonts.ensure(edited, { renderOptions }),
  ]);
  assert.equal(results[0].lazy.length, 2);
  assert.equal(results[1].lazy.length, 0);
  assert.equal(new Set(fonts.fontFiles).size, fonts.fontFiles.length);
  const baseline = await full();
  for (const text of ['system', 'fonts', 'paths'])
    assert.equal(
      toSvg(edited, 1, { ...renderOptions, fonts, text }),
      toSvg(edited, 1, { ...renderOptions, fonts: baseline, text }),
      text,
    );
  await fonts.ensure(other, { renderOptions });
  assert.deepEqual(fonts.pending(other, renderOptions), []);
  assert.equal(
    toSvg(other, 1, { ...renderOptions, fonts, text: 'system' }),
    toSvg(other, 1, { ...renderOptions, fonts: baseline, text: 'system' }),
  );
  assert.equal(
    toSvg(simple, 1, { ...renderOptions, fonts, text: 'system' }),
    toSvg(simple, 1, { ...renderOptions, fonts: baseline, text: 'system' }),
  );
});

test('caller faces stay explicit and take precedence while unknown/policy-disallowed families stay errors', async () => {
  const baseline = await full(),
    file = baseline.fontFiles.find((file) => /Intos-Regular/.test(file)),
    own = { path: file, family: 'Caller Supplied', weight: 400, italic: false };
  const fonts = await loadFonts({ ...request(simple), faces: [own] });
  assert.ok(
    fonts.registry
      .describeFaces()
      .some((face) => face.family === 'Caller Supplied'),
  );
  assert.ok(fonts.fontFiles.includes(file));
  assert.equal(
    fonts.registry.resolveFont({
      fontFamily: 'Caller Supplied',
      fontWeight: 400,
    }).resolvedFamily,
    'Caller Supplied',
  );
  const unknown = {
    slides: [{ text: [{ text: 'Unknown', fontFamily: 'Never A Real Font' }] }],
  };
  await assert.rejects(
    async () => {
      const prepared = await loadFonts(request(unknown));
      toSvg(unknown, 1, { ...renderOptions, fonts: prepared });
    },
    (error) => error.code === 'font-unavailable',
  );
});

test('CJK, Arabic and Greek fallback retain exact eager SVG and actual weight/style choices', async () => {
  for (const [language, scheme, title, text] of [
    ['ja', 'aptos', 'Q3 レビュー', 'Revenue 日本語です'],
    ['ar', 'aptos', 'مراجعة ربع سنوية', 'ارتفعت المبيعات by 12%'],
    ['en', 'georgia', 'Greek review', 'Ἀθήνα — Привет'],
  ]) {
    const doc = {
        language,
        design: { fontScheme: scheme },
        slides: [{ title, text }],
      },
      selection = autoScriptSelection(doc, renderOptions),
      baseline = await loadFonts({ ...options, scripts: selection.scripts }),
      fonts = await loadFonts(request(doc));
    assert.deepEqual(fonts.pending(doc, renderOptions), []);
    for (const mode of ['system', 'paths'])
      assert.equal(
        toSvg(doc, 1, { ...renderOptions, fonts, text: mode }),
        toSvg(doc, 1, { ...renderOptions, fonts: baseline, text: mode }),
        language + ' ' + mode,
      );
  }
});

test('the generated preferred-family companion exactly matches every pinned physical candidate', async () => {
  const require = createRequire(import.meta.url),
    root = fileURLToPath(new URL('../', import.meta.url)),
    expected = [];
  for (const pkg of BUNDLED_FONT_MANIFEST.packages) {
    const dir = pkg.vendored
      ? path.join(root, pkg.vendored)
      : path.dirname(require.resolve(pkg.name + '/package.json'));
    for (const face of pkg.faces) {
      const bytes = await readFile(path.join(dir, face.file)),
        group = selectionFamilyGroup(create(bytes), face.family);
      if (group !== face.family)
        expected.push({
          package: pkg.name,
          file: face.file,
          sha256: face.sha256,
          familyGroup: group,
        });
    }
  }
  assert.deepEqual(FONT_SELECTION_METADATA, expected);
  const baseline = await full(),
    actual = baseline.registry.describeFaces({ selection: true }),
    aliases = new Map();
  for (const weight of [500, 600, 800]) {
    const selection = pickFace(
      actual,
      'Roboto',
      { fontWeight: weight },
      { aliases },
    );
    assert.equal(selection.face.weight, weight);
    assert.equal(selection.face.familyGroup, 'Roboto');
  }
  assert.ok(actual.every((face) => descriptor(face).length === 4));
});
