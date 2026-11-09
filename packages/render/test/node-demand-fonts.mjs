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
    ['ja', 'aptos', '日本語', 'こんにちは'],
    ['ar', 'aptos', 'مراجعة', 'ارتفعت المبيعات'],
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

test('unused optional packages are never resolved; missing needed faces fail honestly and failed ensure retries', async () => {
  const { execFileSync } = await import('node:child_process');
  const moduleURL = new URL('../dist/fonts-node.js', import.meta.url).href,
    galleryURL = new URL('../../gallery/dist/index.js', import.meta.url).href;
  const code = String.raw`
import fs from 'node:fs/promises';import{registerHooks,syncBuiltinESMExports}from'node:module';
const mode=process.argv[1],moduleURL=process.argv[2],galleryURL=process.argv[3],calls=[];
if(mode==='optional')registerHooks({resolve(specifier,context,next){if(specifier.includes('@expo-google-fonts/'))calls.push(specifier);if(specifier==='@expo-google-fonts/roboto-mono/package.json')throw Object.assign(Error('Not installed'),{code:'MODULE_NOT_FOUND'});return next(specifier,context);}});
if(mode==='required')registerHooks({resolve(specifier,context,next){if(specifier==='@expo-google-fonts/roboto/package.json')throw Object.assign(Error('Not installed'),{code:'MODULE_NOT_FOUND'});return next(specifier,context);}});
const {loadFonts}=await import(moduleURL),{gallery}=await import(galleryURL),renderOptions={catalogs:[gallery]},doc={slides:[{title:'Title',text:'Body'}]},opts={pack:'office',substitutionPolicy:'visual',presentation:doc,scripts:'auto',renderOptions};
if(mode==='optional'){const fonts=await loadFonts(opts);console.log(JSON.stringify({faces:fonts.fontFiles.length,unneeded:calls.filter(s=>s.includes('roboto-mono')).length}));}
else if(mode==='required'){let result;try{await loadFonts({...opts,presentation:{design:{fontScheme:'roboto'},slides:[{text:'Body'}]}});}catch(error){result={code:error.code,packages:error.details?.packages,message:error.message};}console.log(JSON.stringify(result??{unexpectedSuccess:true}));}
else{const fonts=await loadFonts(opts),before=fonts.fontFiles.length,original=fs.readFile;fs.readFile=async function(file,...args){const data=await original.call(this,file,...args);if(String(file).endsWith('Intos-Italic.ttf')){const copy=Buffer.from(data);copy[copy.length-1]^=1;return copy;}return data;};syncBuiltinESMExports();const edit={slides:[{title:'Title',text:[{text:'Italic',italic:true}]}]};let refused;try{await fonts.ensure(edit,{renderOptions});}catch(error){refused=error.code;}const afterFailure=fonts.fontFiles.length;fs.readFile=original;syncBuiltinESMExports();const retried=await fonts.ensure(edit,{renderOptions});console.log(JSON.stringify({before,refused,afterFailure,added:retried.lazy.length,after:fonts.fontFiles.length,pending:fonts.pending(edit,renderOptions)}));}
`;
  const child = (mode) =>
    JSON.parse(
      execFileSync(
        process.execPath,
        ['--input-type=module', '-e', code, mode, moduleURL, galleryURL],
        { encoding: 'utf8', timeout: 20000, maxBuffer: 1000000 },
      ).trim(),
    );
  const unused = child('optional');
  assert.equal(unused.faces, 2);
  assert.equal(unused.unneeded, 0);
  const required = child('required');
  assert.equal(required.code, 'font-resource-unavailable');
  assert.deepEqual(required.packages, ['@expo-google-fonts/roboto']);
  const retry = child('integrity');
  assert.equal(retry.refused, 'font-integrity-mismatch');
  assert.equal(retry.afterFailure, retry.before);
  assert.equal(retry.added, 1);
  assert.equal(retry.after, retry.before + 1);
  assert.deepEqual(retry.pending, []);
});

test('style-only metadata keeps absent roles cheap and exact while unprepared measured weights still refuse', async () => {
  const doc = {
      design: { fontScheme: 'roboto' },
      slides: [{ title: 'Weight metadata', text: 'Body' }],
    },
    fonts = await loadFonts(request(doc)),
    before = fonts.fontFiles.length;
  assert.equal(
    fonts.registry.resolveFont({ fontFamily: 'Roboto', fontWeight: 500 })
      .resolvedWeight,
    500,
  );
  assert.equal(fonts.fontFiles.length, before);
  assert.throws(
    () =>
      fonts.textMeasurement.measure('Measured', 20, {
        fontFamily: 'Roboto',
        fontWeight: 500,
      }),
    (error) =>
      error.code === 'font-unavailable' && /ensure/.test(error.message),
  );
  assert.throws(
    () =>
      fonts.textMeasurement.measure('Measured', 20, {
        fontFamily: 'Roboto',
        fontWeight: NaN,
      }),
    { code: 'invalid-font-weight' },
  );
  const edit = {
    design: doc.design,
    slides: [
      {
        title: 'Weight metadata',
        text: [{ text: 'Medium', fontFamily: 'Roboto Medium' }],
      },
    ],
  };
  await fonts.ensure(edit, { renderOptions });
  assert.ok(
    fonts.registry
      .describeFaces()
      .some((face) => face.family === 'Roboto Medium' && face.weight === 500),
  );
  const baseline = await full();
  assert.equal(
    fonts.textMeasurement.measure('Measured', 20, {
      fontFamily: 'Roboto',
      fontWeight: 500,
    }),
    baseline.textMeasurement.measure('Measured', 20, {
      fontFamily: 'Roboto',
      fontWeight: 500,
    }),
  );
});
