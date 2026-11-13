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
import fs from 'node:fs/promises';import module,{syncBuiltinESMExports}from'node:module';import{createHash}from'node:crypto';
const mode=process.argv[1],moduleURL=process.argv[2],galleryURL=process.argv[3],calls=[],blockedResolutions=[],nodeResolveURL=new URL('./node-resolve.js',moduleURL).href;let ownedResolvers=0;
// Intercept the actual createRequire(...).resolve boundary before the loader captures it, including Node22.
const createRequire=module.createRequire;module.createRequire=(...args)=>{const require=createRequire(...args),resolve=require.resolve;if(String(args[0])===nodeResolveURL)ownedResolvers++;require.resolve=(specifier,...options)=>{if(mode==='optional'&&specifier.includes('@expo-google-fonts/'))calls.push(specifier);if((mode==='optional'&&specifier==='@expo-google-fonts/roboto-mono/package.json')||(mode==='required'&&specifier==='@expo-google-fonts/roboto/package.json')){blockedResolutions.push(specifier);throw Object.assign(Error('Not installed'),{code:'MODULE_NOT_FOUND'});}return resolve(specifier,...options);};return require;};syncBuiltinESMExports();
const {loadFonts}=await import(moduleURL),{gallery}=await import(galleryURL),renderOptions={catalogs:[gallery]},doc={slides:[{title:'Title',text:'Body'}]},opts={pack:'office',substitutionPolicy:'visual',presentation:doc,scripts:'auto',renderOptions};
if(mode==='optional'){const fonts=await loadFonts(opts);console.log(JSON.stringify({faces:fonts.fontFiles.length,unneeded:calls.filter(s=>s.includes('roboto-mono')).length,ownedResolvers,blockedResolutions}));}
else if(mode==='required'){let result,loadReturned=false;try{await loadFonts({...opts,presentation:{design:{fontScheme:'roboto'},slides:[{text:'Body'}]}});loadReturned=true;}catch(error){result={code:error.code,packages:error.details?.packages,message:error.message};}console.log(JSON.stringify({...(result??{unexpectedSuccess:true}),loadReturned,ownedResolvers,blockedResolutions}));}
else{const fonts=await loadFonts(opts),before=fonts.fontFiles.length,original=fs.readFile;let protectedFile,protectedBefore;fs.readFile=async function(file,...args){const data=await original.call(this,file,...args);if(String(file).endsWith('Intos-Italic.ttf')){protectedFile=file;protectedBefore=createHash('sha256').update(data).digest('hex');const copy=Buffer.from(data);copy[copy.length-1]^=1;return copy;}return data;};syncBuiltinESMExports();const edit={slides:[{title:'Title',text:[{text:'Italic',italic:true}]}]};let refused;try{await fonts.ensure(edit,{renderOptions});}catch(error){refused=error.code;}const afterFailure=fonts.fontFiles.length;fs.readFile=original;syncBuiltinESMExports();const retried=await fonts.ensure(edit,{renderOptions});const protectedAfter=createHash('sha256').update(await original(protectedFile)).digest('hex');console.log(JSON.stringify({before,refused,afterFailure,added:retried.lazy.length,after:fonts.fontFiles.length,pending:fonts.pending(edit,renderOptions),protectedBefore,protectedAfter}));}
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
  assert.ok(unused.ownedResolvers >= 1, JSON.stringify(unused));
  assert.deepEqual(unused.blockedResolutions, []);
  const required = child('required');
  assert.ok(required.ownedResolvers >= 1, JSON.stringify(required));
  assert.equal(required.loadReturned, false, JSON.stringify(required));
  assert.ok(required.blockedResolutions.length >= 1, JSON.stringify(required));
  assert.ok(required.blockedResolutions.every(specifier => specifier === '@expo-google-fonts/roboto/package.json'));
  assert.equal(required.code, 'font-resource-unavailable');
  assert.deepEqual(required.packages, ['@expo-google-fonts/roboto']);
  const retry = child('integrity');
  assert.equal(retry.refused, 'font-integrity-mismatch');
  assert.match(retry.protectedBefore, /^[a-f0-9]{64}$/);
  assert.equal(
    retry.protectedAfter,
    retry.protectedBefore,
    'resolution/read hooks never mutate pinned package bytes',
  );
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

test('optional script absence retains bounded fallback ordering and all-unavailable diagnostics without weakening real measurement', async () => {
  const { execFileSync } = await import('node:child_process');
  const moduleURL = new URL('../dist/fonts-node.js', import.meta.url).href;
  const rendererURL = new URL('../dist/index.js', import.meta.url).href;
  const galleryURL = new URL('../../gallery/dist/index.js', import.meta.url)
    .href;
  const code = String.raw`
import module,{syncBuiltinESMExports} from 'node:module';
const mode=process.argv[1],calls=[],blockedResolutions=[],nodeResolveURL=new URL('./node-resolve.js',process.argv[2]).href;let ownedResolvers=0;
const createRequire=module.createRequire;module.createRequire=(...args)=>{const require=createRequire(...args),resolve=require.resolve;if(String(args[0])===nodeResolveURL)ownedResolvers++;require.resolve=(specifier,...options)=>{if(specifier.includes('@expo-google-fonts/'))calls.push(specifier);if(mode==='jp'?specifier==='@expo-google-fonts/noto-sans-jp/package.json':/^@expo-google-fonts\/noto-(sans|serif)-(jp|sc|tc|hk|kr)\//.test(specifier)){blockedResolutions.push(specifier);throw Object.assign(Error('Simulated absent optional package'),{code:'MODULE_NOT_FOUND'});}return resolve(specifier,...options);};return require;};syncBuiltinESMExports();
const {loadFonts}=await import(process.argv[2]),{toSvg}=await import(process.argv[3]),{gallery}=await import(process.argv[4]);
const presentation={language:'ja',slides:[{title:'日本語',text:'こんにちは'}]},renderOptions={catalogs:[gallery]},options={pack:'office',substitutionPolicy:'visual',scripts:'auto',renderOptions};
async function run(demand){const diagnostics=[],blockedBefore=blockedResolutions.length;const fonts=await loadFonts({...options,...(demand?{presentation}:{scripts:[]}),onDiagnostic:d=>diagnostics.push(d)});if(!demand)await fonts.ensure(presentation,{renderOptions,onDiagnostic:d=>diagnostics.push(d)});let output;try{output={svg:toSvg(presentation,1,{...renderOptions,fonts,text:'paths'})};}catch(error){output={code:error.code};}return {diagnostics:diagnostics.filter(d=>d.code.startsWith('script-')).map(d=>[d.code,d.package??d.characters]),output,pending:fonts.pending(presentation,renderOptions),selection:fonts.registry.scriptSelection,preparationReturned:true,blockedResolutions:blockedResolutions.slice(blockedBefore)};}
console.log(JSON.stringify({eager:await run(false),demand:await run(true),calls,ownedResolvers,blockedResolutions}));
`;
  for (const mode of ['jp', 'all']) {
    const result = JSON.parse(
      execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          code,
          mode,
          moduleURL,
          rendererURL,
          galleryURL,
        ],
        { encoding: 'utf8', timeout: 20000, maxBuffer: 4000000 },
      ).trim(),
    );
    assert.ok(result.ownedResolvers >= 1, JSON.stringify({ mode, ownedResolvers: result.ownedResolvers }));
    for (const [phase, facts] of [['eager', result.eager], ['demand', result.demand]]) {
      const evidence = JSON.stringify({ mode, phase, preparationReturned: facts.preparationReturned, blockedResolutions: facts.blockedResolutions });
      assert.equal(facts.preparationReturned, true, evidence);
      assert.ok(facts.blockedResolutions.includes('@expo-google-fonts/noto-sans-jp/package.json'), evidence);
      assert.ok(facts.blockedResolutions.every(specifier => mode === 'jp' ? specifier === '@expo-google-fonts/noto-sans-jp/package.json' : /^@expo-google-fonts\/noto-(sans|serif)-(jp|sc|tc|hk|kr)\//.test(specifier)), evidence);
    }
    assert.deepEqual(result.demand.output, result.eager.output, mode);
    assert.ok(
      result.demand.diagnostics.some(
        ([code, pkg]) =>
          code === 'script-font-not-installed' &&
          pkg === '@expo-google-fonts/noto-sans-jp',
      ),
    );
    assert.deepEqual(result.demand.pending, []);
    if (mode === 'jp') {
      assert.ok(result.demand.output.svg);
      assert.ok(
        result.demand.selection.packages.includes(
          '@expo-google-fonts/noto-sans-sc',
        ),
      );
      assert.equal(
        result.demand.selection.packages.filter((pkg) =>
          /noto-sans-(sc|tc|hk|kr)$/.test(pkg),
        ).length,
        1,
      );
    } else {
      assert.equal(result.demand.output.code, 'missing-glyph');
      assert.ok(
        result.demand.diagnostics.some(
          ([code]) => code === 'script-glyph-uncovered',
        ),
      );
    }
  }
});

test('explicit aliases and fallbackFamily select the same single actual face as the whole base pack', async () => {
  for (const substitution of [
    { aliases: { 'Owned Alias': 'Roboto' } },
    { fallbackFamily: 'Roboto' },
  ]) {
    const doc = {
        slides: [{ text: [{ text: 'Alias body', fontFamily: 'Owned Alias' }] }],
      },
      config = { pack: 'base', substitutionPolicy: 'visual', ...substitution };
    const baseline = await loadFonts(config),
      fonts = await loadFonts({ ...config, presentation: doc, renderOptions });
    assert.equal(fonts.fontFiles.length, 1);
    for (const text of ['system', 'fonts', 'paths'])
      assert.equal(
        toSvg(doc, 1, { ...renderOptions, fonts, text }),
        toSvg(doc, 1, { ...renderOptions, fonts: baseline, text }),
        text,
      );
  }
});

test('document preparation preserves unresolved-family inspection; actual measurement and drawing still refuse', async () => {
  for (const doc of [
    simple,
    {
      slides: [
        { text: [{ text: 'Unknown', fontFamily: 'Never A Real Font' }] },
      ],
    },
  ]) {
    const config = { pack: 'base', scripts: 'auto', renderOptions };
    const fonts = await loadFonts({ ...config, presentation: doc });
    assert.deepEqual(fonts.pending(doc, renderOptions), []);
    const baseline = await loadFonts({ pack: 'base' });
    assert.throws(() => toSvg(doc, 1, { ...renderOptions, fonts }), {
      code: 'font-unavailable',
    });
    assert.throws(() => toSvg(doc, 1, { ...renderOptions, fonts: baseline }), {
      code: 'font-unavailable',
    });
    assert.throws(
      () =>
        fonts.textMeasurement.measure('Drawn', 20, {
          fontFamily: 'Aptos Display',
        }),
      { code: 'font-unavailable' },
    );
  }
});
