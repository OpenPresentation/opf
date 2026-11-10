import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  loadFonts,
  autoScriptSelection,
} from '@openpresentation/opf-render/fonts-node';
import { gallery } from '@openpresentation/gallery';
import { unzipSync, strFromU8 } from 'fflate';
import { toPptx } from '../dist/index.js';
const catalogs = [gallery],
  renderOptions = { catalogs },
  options = { pack: 'office', substitutionPolicy: 'visual' },
  doc = {
    slides: [
      {
        title: 'Font demand',
        text: [
          'Regular ',
          { text: 'bold', bold: true },
          ' ',
          { text: 'italic', italic: true },
        ],
      },
      {
        title: 'Table',
        table: {
          columns: ['Name', 'Value'],
          rows: [
            ['A', 12],
            ['B', 24],
          ],
        },
      },
    ],
  };
function assertParts(a, b) {
  const left = unzipSync(a),
    right = unzipSync(b),
    parts = Object.keys(left).filter((name) =>
      /^ppt\/(slides|theme)\/.+\.xml$/.test(name),
    );
  assert.ok(parts.length >= 3);
  for (const part of parts)
    assert.equal(strFromU8(left[part]), strFromU8(right[part]), part);
}
for (const typefaces of ['selected', 'safe'])
  test(
    'native ' + typefaces + ' PPTX fonts and geometry match whole-pack output',
    async () => {
      const full = await loadFonts(options),
        demand = await loadFonts({
          ...options,
          presentation: doc,
          scripts: 'auto',
          renderOptions,
        });
      const expected = await toPptx(doc, {
          catalogs,
          fonts: full,
          typefaces,
          date: '2026-11-09',
        }),
        actual = await toPptx(doc, {
          catalogs,
          fonts: demand,
          typefaces,
          date: '2026-11-09',
        });
      assertParts(actual, expected);
      if (typefaces === 'safe')
        assert.ok(
          demand.registry
            .describeFaces()
            .some((face) => face.family === 'Arimo'),
          'safe export prepares actual Arial measurement faces',
        );
      assert.ok(demand.fontFiles.length < 10);
    },
  );
test('native mixed-script chosen names and measured boxes match eager font preparation', async () => {
  const doc = {
      language: 'ja',
      slides: [{ title: 'Q3 レビュー', text: 'Revenue 日本語です' }],
    },
    scripts = autoScriptSelection(doc, renderOptions).scripts,
    full = await loadFonts({ ...options, scripts }),
    demand = await loadFonts({
      ...options,
      presentation: doc,
      scripts: 'auto',
      renderOptions,
    });
  assertParts(
    await toPptx(doc, { catalogs, fonts: demand }),
    await toPptx(doc, { catalogs, fonts: full }),
  );
  assert.ok(demand.fontFiles.length < 10);
});

test('code faces load when code is drawn, while unused code role names require no font bytes', async () => {
  const doc = { slides: [{ title: 'Code', code: 'const value = 1;' }] },
    full = await loadFonts(options),
    demand = await loadFonts({
      ...options,
      presentation: doc,
      scripts: 'auto',
      renderOptions,
    });
  assert.ok(
    demand.registry
      .describeFaces()
      .some((face) => face.family === 'Roboto Mono'),
  );
  assertParts(
    await toPptx(doc, { catalogs, fonts: demand }),
    await toPptx(doc, { catalogs, fonts: full }),
  );
});
test('pure script native role metadata does not require unrelated Latin font bytes', async () => {
  const doc = {
      language: 'ja',
      slides: [{ title: '日本語', text: 'こんにちは' }],
    },
    scripts = autoScriptSelection(doc, renderOptions).scripts,
    full = await loadFonts({ ...options, scripts }),
    demand = await loadFonts({
      ...options,
      presentation: doc,
      scripts: 'auto',
      renderOptions,
    });
  assertParts(
    await toPptx(doc, { catalogs, fonts: demand }),
    await toPptx(doc, { catalogs, fonts: full }),
  );
});
