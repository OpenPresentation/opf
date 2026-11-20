import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gallery } from '@openpresentation/gallery';
import { loadFonts } from '@openpresentation/opf-render/fonts-node';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { strFromU8, unzipSync } = createRequire(
  require.resolve('@openpresentation/opf-pptx'),
)('fflate');
import { convert } from '../dist/index.js';

const date = '2026-11-09';
const catalogs = [
  {
    ...gallery,
    source: 'https://catalog.example/rr114',
    fontSchemes: {
      ...gallery.fontSchemes,
      'host-demand': {
        name: 'Host demand',
        app: 'powerpoint',
        languageFamily: 'latin',
        languages: [],
        major: 'Source Sans 3',
        minor: 'Roboto',
        textSample: 'Text',
        type: 'sans-serif',
      },
    },
  },
];
const source = {
  design: {
    fontScheme: 'host-demand',
    footer: { start: { date: true, dateFormat: 'MMMM d, yyyy' } },
  },
  slides: [
    {
      title: 'Rich table',
      table: {
        columns: [{ value: 'Product', style: { bold: true } }, 'Status'],
        rows: [
          [
            {
              value: [
                { text: 'Table italic', italic: true, fontFamily: 'Georgia' },
              ],
            },
            { value: [{ text: 'Table bold', bold: true }] },
          ],
        ],
      },
    },
    {
      title: 'Shape text',
      blocks: [
        {
          shape: 'roundRect',
          text: [
            { text: 'Shape regular ', fontFamily: 'Roboto' },
            { text: 'shape italic', italic: true, fontFamily: 'Roboto' },
          ],
        },
      ],
    },
    {
      title: 'Explicit chart target',
      chart: {
        type: 'line',
        data: {
          columns: ['Month', 'Revenue'],
          rows: [
            ['Jan', 2],
            ['Feb', 4],
            ['Mar', 3],
          ],
        },
        referenceLines: [
          { value: 3.5, label: 'Reference label', stroke: { dash: 'dash' } },
        ],
      },
    },
    {
      title: 'Flow',
      diagram: 'flowchart LR\n A[Diagram start] --> B[Diagram finish]',
    },
  ],
};
const options = { catalogs, date, paginate: false };
const fontOptions = { pack: 'office', substitutionPolicy: 'visual' };
function assertPptxParts(actual, expected) {
  const a = unzipSync(actual),
    b = unzipSync(expected);
  const parts = Object.keys(b).filter((name) =>
    /^ppt\/(slides|theme|charts)\/.+\.xml$/.test(name),
  );
  assert.ok(
    parts.some((name) => name.startsWith('ppt/charts/')),
    'native chart exists',
  );
  for (const name of parts)
    assert.equal(strFromU8(a[name]), strFromU8(b[name]), name);
}

test('actual Node SVG conversion prepares rich table, shape, chart reference and diagram text using the same host catalog/date', async () => {
  const full = await loadFonts(fontOptions);
  const demand = await loadFonts({
    ...fontOptions,
    presentation: { slides: [] },
    scripts: 'auto',
  });
  assert.equal(demand.fontFiles.length, 0);
  const expected = await convert(source, {
    ...options,
    format: 'svg',
    text: 'paths',
    fonts: full,
  });
  const actual = await convert(source, {
    ...options,
    format: 'svg',
    text: 'paths',
    fonts: demand,
  });
  assert.deepEqual(
    actual.files.map((file) => file.bytes),
    expected.files.map((file) => file.bytes),
  );
  assert.equal(actual.files.length, 4);
  assert.deepEqual(demand.pending(source, { catalogs, date }), []);
  assert.ok(demand.fontFiles.length < 12);
  for (const name of ['Source Sans 3', 'Roboto', 'Gelasio'])
    assert.ok(
      demand.registry.describeFaces().some((face) => face.family === name),
      name,
    );
  assert.ok(
    !actual.findings.some((finding) =>
      /diagram-unavailable|font-unavailable|date-needs-value|unresolved-reference/.test(
        finding.ruleId,
      ),
    ),
    JSON.stringify(actual.findings),
  );
  // A normal caller with no font handle uses the same document-aware shared lease.
  const automatic = await convert(source, {
    ...options,
    format: 'svg',
    text: 'paths',
  });
  assert.deepEqual(
    automatic.files.map((file) => file.bytes),
    expected.files.map((file) => file.bytes),
  );
  const strings = await convert(source, {
    ...options,
    format: 'svg',
    text: 'system',
    fonts: demand,
  });
  for (const [index, text] of [
    [0, 'Table italic'],
    [1, 'shape italic'],
    [2, 'Reference label'],
    [3, 'Diagram start'],
  ])
    assert.ok(
      Buffer.from(strings.files[index].bytes).toString('utf8').includes(text),
      text,
    );
  assert.ok(
    Buffer.from(strings.files[0].bytes)
      .toString('utf8')
      .includes('November 9, 2026'),
  );
});

test('actual selected and safe Node PPTX conversion keeps native font names and chart/shape/diagram geometry identical', async () => {
  const full = await loadFonts(fontOptions);
  for (const typefaces of ['selected', 'safe']) {
    const expected = await convert(source, {
      ...options,
      format: 'pptx',
      typefaces,
      fonts: full,
    });
    const actual = await convert(source, {
      ...options,
      format: 'pptx',
      typefaces,
    });
    assertPptxParts(actual.files[0].bytes, expected.files[0].bytes);
  }
});

test('concurrent Node conversions keep catalog/date context separate and edits prepare new measured faces', async () => {
  const full = await loadFonts(fontOptions);
  const first = { slides: [{ title: 'First', text: 'Regular' }] };
  const edit = {
    ...source,
    slides: [
      {
        title: 'Edited',
        text: [
          {
            text: 'New weight',
            fontFamily: 'Roboto',
            bold: true,
            italic: true,
          },
        ],
      },
    ],
  };
  const jobs = [
    [first, { date: '2026-01-02' }],
    [edit, { catalogs, date: '2026-02-03' }],
    [source, options],
  ];
  const actual = await Promise.all(
    jobs.map(([doc, context]) =>
      convert(doc, {
        ...context,
        paginate: false,
        format: 'svg',
        text: 'paths',
      }),
    ),
  );
  for (let i = 0; i < jobs.length; i++) {
    const [doc, context] = jobs[i];
    const expected = await convert(doc, {
      ...context,
      paginate: false,
      format: 'svg',
      text: 'paths',
      fonts: full,
    });
    assert.deepEqual(
      actual[i].files.map((file) => file.bytes),
      expected.files.map((file) => file.bytes),
      `job ${i}`,
    );
  }
});
