import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { createFontAnalysis } from '../dist/lazy-fonts.js';
import { loadFonts } from '../dist/fonts-node.js';
import { toSvg } from '../dist/svg.js';
import { deckInternals } from '../dist/svg-internals.js';
import { preparationContext } from '../dist/font-preparation-context.js';
import { gallery } from '@openpresentation/gallery';
import { fontCoverageProbe } from '../dist/script-fonts.js';
const document = {
  design: { fontScheme: { major: 'Roboto', minor: 'Roboto' } },
  slides: [
    { title: 'First title', text: 'First body' },
    { title: 'Second title', text: 'Second body' },
    { title: 'Third title', text: 'Third body' },
  ],
};
const full = await loadFonts({ pack: 'base' }),
  pool = full.registry.describeFaces({ selection: true });
const scope = (analysis, run) =>
  analysis.withPreparationReplay ? analysis.withPreparationReplay(run) : run(undefined);
test('one active cold preparation records N slides once and pending uses promoted face maps', async () => {
  const analysis = createFontAnalysis();
  let held = false;
  const view = {
    faces: pool,
    coverageKey: 0,
    preparationContext: 'fixed-context',
    coverage: (text, size, style) => {
      if (held) full.textMeasurement.measure(text, size, style);
    },
  };
  const before = toSvg(document, 1, { fonts: full, text: 'paths' });
  let first, second;
  await scope(analysis, async (preparationReplay) => {
    first = analysis.faces(document, {}, { ...view, preparationReplay });
    held = true;
    view.coverageKey = 1;
    view.faces = [...pool].reverse();
    second = analysis.faces(document, {}, { ...view, preparationReplay });
  });
  assert.deepEqual(second, first);
  assert.equal(
    analysis.stats.slides,
    document.slides.length,
    'verified held transition reuses only recorded faces, not a second composition',
  );
  assert.deepEqual(analysis.faces(document, {}, view), first);
  assert.equal(
    analysis.stats.slides,
    document.slides.length,
    'pending does not defer the second full pass',
  );
  const demand = await loadFonts({ pack: 'base', scripts: 'auto', presentation: document });
  assert.equal(toSvg(document, 1, { fonts: demand, text: 'paths' }), before);
  assert.equal(toSvg(document, 1, { fonts: full, text: 'paths' }), before);
});
test('normal preparation observes an owned font-scheme catalog mutation during a held font read', () => {
  const code = String.raw`
 import fs from 'node:fs/promises';import {syncBuiltinESMExports} from 'node:module';import {createHash} from 'node:crypto';
 const {gallery}=await import(process.argv[2]);const catalog={...gallery,source:'https://catalog.example/owned-mutation',fontSchemes:{...gallery.fontSchemes,owned:{name:'Owned',app:'powerpoint',languageFamily:'latin',languages:[],major:'Roboto',minor:'Roboto',textSample:'Text',type:'sans-serif'}}};
 let changed=false,protectedFile,protectedBefore;const original=fs.readFile;fs.readFile=async function(file,...args){const bytes=await original.call(this,file,...args);if(!changed&&String(file).includes('Roboto_700Bold.ttf')){changed=true;protectedFile=file;protectedBefore=createHash('sha256').update(bytes).digest('hex');catalog.fontSchemes.owned.major='Arimo';catalog.fontSchemes.owned.minor='Arimo';}return bytes;};syncBuiltinESMExports();
 const {loadFonts}=await import(process.argv[1]);const doc={design:{fontScheme:'owned'},slides:[{title:'Title',text:'Body'}]},renderOptions={catalogs:[catalog]};const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:doc,renderOptions});fs.readFile=original;syncBuiltinESMExports();
 console.log(JSON.stringify({changed,faces:fonts.registry.describeFaces().map(face=>[face.family,face.weight]),pending:fonts.pending(doc,renderOptions),width:fonts.textMeasurement.measure('Title',24,{fontFamily:'Arimo',fontWeight:700}),protectedBefore,protectedAfter:createHash('sha256').update(await original(protectedFile)).digest('hex')}));`;
  const result = JSON.parse(
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        code,
        new URL('../dist/fonts-node.js', import.meta.url).href,
        new URL('../../gallery/dist/index.js', import.meta.url).href,
      ],
      { encoding: 'utf8', timeout: 20000, maxBuffer: 1000000 },
    ).trim(),
  );
  assert.equal(result.changed, true);
  assert.ok(result.faces.some(([family, weight]) => family === 'Arimo' && weight === 700));
  assert.deepEqual(result.pending, []);
  assert.ok(result.width > 0);
  assert.equal(result.protectedBefore, result.protectedAfter);
  console.log('owned read mutation', JSON.stringify(result));
});

test('actual default gallery remains eligible and the Node loader does not defer recording to pending', async () => {
  const doc = { ...structuredClone(document), design: { fontScheme: 'roboto' } },
    renderOptions = { catalogs: [gallery] };
  assert.match(preparationContext(doc, renderOptions), /^[a-f0-9]{64}$/);
  const original = deckInternals.openDeck;
  let binds = 0;
  deckInternals.openDeck = (...args) => {
    const opened = original(...args);
    return {
      ...opened,
      bind(...rest) {
        binds++;
        return opened.bind(...rest);
      },
    };
  };
  try {
    const fonts = await loadFonts({
      pack: 'office',
      substitutionPolicy: 'visual',
      scripts: 'auto',
      presentation: doc,
      renderOptions,
    });
    assert.equal(binds, doc.slides.length);
    assert.deepEqual(fonts.pending(doc, renderOptions), []);
    assert.equal(binds, doc.slides.length);
  } finally {
    deckInternals.openDeck = original;
  }
});

const baseView = () => ({
  faces: pool,
  coverageKey: 0,
  preparationContext: 'fixed-context',
  coverage() {},
});
async function injected(inject, run) {
  const original = deckInternals.openDeck;
  deckInternals.openDeck = (...args) => {
    const opened = original(...args);
    return {
      ...opened,
      bind(index, measurement, ...rest) {
        if (index === 0) inject(measurement);
        return opened.bind(index, measurement, ...rest);
      },
    };
  };
  try {
    return await run();
  } finally {
    deckInternals.openDeck = original;
  }
}
const request = (path = 'trace.first', extra = {}) => ({
  fontFamily: 'Roboto',
  fontWeight: 400,
  italic: false,
  lang: 'de',
  direction: 'rtl',
  symbolEncoding: null,
  path,
  ...extra,
});
for (const [name, change] of [
  [
    'content',
    (state) => {
      state.doc.slides[0].text = 'Edited body';
    },
  ],
  [
    'options',
    (state) => {
      state.options = { date: '2026-11-10' };
    },
  ],
  [
    'context digest',
    (state) => {
      state.view.preparationContext = 'changed-context';
    },
  ],
  [
    'mode',
    (state) => {
      state.view.preserveChosenFamilies = true;
    },
  ],
  [
    'callable mapping',
    (state) => {
      state.view.mapFamily = (family) => family;
    },
  ],
  [
    'script activation metadata',
    (state) => {
      state.view.faces = state.view.faces.map((face, index) =>
        index === 0 ? { ...face, fallbackOnly: !face.fallbackOnly } : face,
      );
    },
  ],
  [
    'ambiguous duplicate',
    (state) => {
      state.view.faces = [...state.view.faces, { ...state.view.faces[0] }];
    },
  ],
])
  test(name + ' refuses generation replay', async () => {
    const analysis = createFontAnalysis(),
      state = { doc: structuredClone(document), view: baseView(), options: {} };
    await scope(analysis, async (preparationReplay) => {
      analysis.faces(state.doc, state.options, { ...state.view, preparationReplay });
      change(state);
      state.view.coverageKey++;
      analysis.faces(state.doc, state.options, { ...state.view, preparationReplay });
    });
    assert.equal(analysis.stats.slides, 2 * document.slides.length);
  });
test('same pool in a different order re-resolves actual selections rather than sorting away a changed winner', async () => {
  const analysis = createFontAnalysis(),
    doc = {
      design: { fontScheme: { major: 'Group', minor: 'Group' } },
      slides: [{ title: 'Title', text: 'Body' }],
    },
    a = { family: 'Face A', familyGroup: 'Group', weight: 400, italic: false },
    b = { family: 'Face B', familyGroup: 'Group', weight: 400, italic: false };
  let first, second;
  await scope(analysis, async (preparationReplay) => {
    const view = {
      faces: [a, b],
      coverageKey: 0,
      preparationContext: 'same',
      coverage() {},
      preparationReplay,
    };
    first = analysis.faces(doc, {}, view);
    second = analysis.faces(doc, {}, { ...view, faces: [b, a], coverageKey: 1 });
  });
  assert.equal(first[0].family, 'Face A');
  assert.equal(second[0].family, 'Face B');
  assert.equal(analysis.stats.slides, 2);
});
test('a new exact face and a mutated alias/policy stay on the ordinary selection path', async () => {
  const doc = {
      design: { fontScheme: { major: 'Requested', minor: 'Requested' } },
      slides: [{ title: 'Title', text: 'Body' }],
    },
    analysis = createFontAnalysis(),
    aliases = new Map([['requested', 'Roboto']]);
  await scope(analysis, async (preparationReplay) => {
    const view = { ...baseView(), aliases, preparationReplay };
    analysis.faces(doc, {}, view);
    aliases.set('requested', 'Roboto Medium');
    const result = analysis.faces(doc, {}, { ...view, coverageKey: 1 });
    assert.ok(result.some((face) => face.family === 'Roboto Medium'));
  });
  assert.equal(analysis.stats.slides, 2);
  const exact = createFontAnalysis();
  await scope(exact, async (preparationReplay) => {
    const view = { ...baseView(), aliases: new Map([['requested', 'Roboto']]), preparationReplay };
    exact.faces(doc, {}, view);
    const result = exact.faces(
      doc,
      {},
      {
        ...view,
        coverageKey: 1,
        faces: [...pool, { family: 'Requested', weight: 400, italic: false }],
      },
    );
    assert.ok(result.some((face) => face.family === 'Requested'));
  });
  assert.equal(exact.stats.slides, 2);
  const policy = createFontAnalysis();
  await scope(policy, async (preparationReplay) => {
    const view = { ...baseView(), policy: 'none', preparationReplay };
    policy.faces(document, {}, view);
    policy.faces(document, {}, { ...view, coverageKey: 1, policy: 'visual' });
  });
  assert.equal(policy.stats.slides, 2 * document.slides.length);
});
test('generic calls and cached/partly cached first rounds never manufacture a replay trace', async () => {
  const generic = createFontAnalysis();
  generic.faces(document, {}, baseView());
  generic.faces(document, {}, { ...baseView(), coverageKey: 1 });
  assert.equal(generic.stats.slides, 2 * document.slides.length);
  for (const partial of [false, true]) {
    const analysis = createFontAnalysis(),
      doc = structuredClone(document);
    analysis.faces(doc, {}, baseView());
    if (partial) doc.slides[0].title = 'An edited title';
    await scope(analysis, async (preparationReplay) => {
      const view = { ...baseView(), preparationReplay };
      analysis.faces(doc, {}, view);
      analysis.faces(doc, {}, { ...view, coverageKey: 1 });
    });
    assert.equal(analysis.stats.slides, 2 * document.slides.length + Number(partial));
  }
});
for (const [name, inject] of [
  [
    '4096 entries',
    (measurement) => {
      for (let index = 0; index < 4100; index++)
        measurement[fontCoverageProbe]('unique ' + index, 1, request());
    },
  ],
  [
    '512KiB retained data',
    (measurement) => {
      measurement[fontCoverageProbe]('A'.repeat(160000), 1, request());
      measurement[fontCoverageProbe]('B'.repeat(160000), 1, request());
    },
  ],
  ['nonpositive size', (measurement) => measurement[fontCoverageProbe]('owned', 0, request())],
  ['nonfinite size', (measurement) => measurement[fontCoverageProbe]('owned', Infinity, request())],
  [
    'unsupported style',
    (measurement) =>
      measurement[fontCoverageProbe](
        'owned',
        1,
        request('trace.first', { lang: { unsupported: true } }),
      ),
  ],
])
  test(name + ' declines replay without dropping the ordinary work', async () => {
    const analysis = createFontAnalysis();
    await injected(inject, () =>
      scope(analysis, async (preparationReplay) => {
        const view = { ...baseView(), preparationReplay };
        analysis.faces(document, {}, view);
        analysis.faces(document, {}, { ...view, coverageKey: 1 });
      }),
    );
    assert.equal(analysis.stats.slides, 2 * document.slides.length);
  });
test('coverage dedup retains the first valid size, first path, language, direction and encoding', async () => {
  const analysis = createFontAnalysis();
  let current = false,
    seen = [];
  await injected(
    (measurement) => {
      measurement[fontCoverageProbe]('owned-first', 20, request());
      measurement[fontCoverageProbe]('owned-first', 40, request('trace.second'));
    },
    () =>
      scope(analysis, async (preparationReplay) => {
        const view = {
          ...baseView(),
          preparationReplay,
          coverage(text, size, style) {
            if (current && text === 'owned-first') seen.push({ size, ...style });
          },
        };
        analysis.faces(document, {}, view);
        current = true;
        analysis.faces(document, {}, { ...view, coverageKey: 1 });
      }),
  );
  assert.equal(analysis.stats.slides, document.slides.length);
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0], { size: 20, ...request() });
});
test('first changed soft probe outcome returns to cold before a later fatal event', async () => {
  const analysis = createFontAnalysis();
  let current = false,
    fatalCalls = 0;
  await injected(
    (measurement) => {
      let covered = true;
      try {
        measurement[fontCoverageProbe]('soft-first', 1, request());
      } catch (error) {
        if (error.code === 'font-unavailable') covered = false;
        else throw error;
      }
      if (covered) measurement[fontCoverageProbe]('fatal-later', 1, request('trace.later'));
    },
    () =>
      scope(analysis, async (preparationReplay) => {
        const view = {
          ...baseView(),
          preparationReplay,
          coverage(text) {
            if (current && text === 'soft-first')
              throw Object.assign(Error('changed coverage'), { code: 'font-unavailable' });
            if (current && text === 'fatal-later') {
              fatalCalls++;
              throw Object.assign(Error('must not be reached'), { code: 'owned-fatal' });
            }
          },
        };
        analysis.faces(document, {}, view);
        current = true;
        analysis.faces(document, {}, { ...view, coverageKey: 1 });
      }),
  );
  assert.equal(fatalCalls, 0);
  assert.equal(analysis.stats.slides, 2 * document.slides.length);
});
for (const kind of ['measure', 'probe'])
  test(
    kind + ' retains the first fatal code/path exactly once and releases failed scope',
    async () => {
      const analysis = createFontAnalysis();
      let current = false,
        calls = 0,
        saved;
      const invoke = (measurement) =>
        kind === 'measure'
          ? measurement.measure('fatal-owned', 20, request())
          : measurement[fontCoverageProbe]('fatal-owned', 20, request());
      await assert.rejects(
        injected(invoke, () =>
          scope(analysis, async (preparationReplay) => {
            saved = preparationReplay;
            const view = {
              ...baseView(),
              preparationReplay,
              coverage(text, size, style) {
                if (current && text === 'fatal-owned') {
                  calls++;
                  throw Object.assign(Error('fatal coverage'), {
                    code: kind === 'measure' ? 'math-font-required' : 'owned-fatal',
                    details: { path: style.path },
                  });
                }
              },
            };
            analysis.faces(document, {}, view);
            current = true;
            analysis.faces(document, {}, { ...view, coverageKey: 1 });
          }),
        ),
        (error) =>
          error.code === (kind === 'measure' ? 'math-font-required' : 'owned-fatal') &&
          error.details.path === 'trace.first',
      );
      assert.equal(calls, 1, 'fatal replay is never caught and retried');
      assert.equal(analysis.stats.slides, document.slides.length);
      analysis.faces(document, {}, { ...baseView(), preparationReplay: saved, coverageKey: 2 });
      assert.equal(
        analysis.stats.slides,
        2 * document.slides.length,
        'failed scope cannot leak its candidate',
      );
    },
  );
test('successful scope is released rather than replayed by a later independent call', async () => {
  const analysis = createFontAnalysis();
  let saved;
  await scope(analysis, async (preparationReplay) => {
    saved = preparationReplay;
    const view = { ...baseView(), preparationReplay };
    analysis.faces(document, {}, view);
    analysis.faces(document, {}, { ...view, coverageKey: 1 });
  });
  assert.equal(analysis.stats.slides, document.slides.length);
  analysis.faces(document, {}, { ...baseView(), coverageKey: 2, preparationReplay: saved });
  assert.equal(analysis.stats.slides, 2 * document.slides.length);
});
test('bounded Node guard preserves actual plain content and rejects accessors/callbacks/cycles/opaque values', () => {
  assert.notEqual(
    preparationContext(document, { language: 'ja' }),
    preparationContext(document, { language: 'ar' }),
  );
  assert.notEqual(
    preparationContext(document, { direction: 'ltr' }),
    preparationContext(document, { direction: 'rtl' }),
  );
  assert.notEqual(
    preparationContext(document, { catalogs: [{ fontSchemes: { owned: { major: 'Roboto' } } }] }),
    preparationContext(document, { catalogs: [{ fontSchemes: { owned: { major: 'Arimo' } } }] }),
  );
  let getters = 0;
  const accessor = {
      get hidden() {
        getters++;
        return 'x';
      },
    },
    cycle = {};
  cycle.self = cycle;
  for (const options of [
    accessor,
    cycle,
    { callback() {} },
    { date: new Date() },
    { invalid: Infinity },
    { value: Symbol('x') },
    {
      value: new Proxy(
        {},
        {
          get() {
            throw Error('getter must not run');
          },
        },
      ),
    },
    { text: 'x'.repeat(2097153) },
    { items: Array(100001).fill(0) },
  ])
    assert.equal(preparationContext(document, options), undefined);
  let deep = {};
  for (let index = 0; index < 66; index++) deep = { deep };
  assert.equal(preparationContext(document, deep), undefined);
  assert.equal(getters, 0);
});

test('language, direction, encoding and native face links remain distinct coverage requirements', async () => {
  const analysis = createFontAnalysis();
  let current = false;
  const seen = [];
  const absentEncoding = request('trace.encoding-absent-own');
  delete absentEncoding.symbolEncoding;
  const variants = [
    absentEncoding,
    request('trace.face-undefined', { fontFace: undefined }),
    request('trace.encoding-null'),
    request('trace.encoding-absent', { symbolEncoding: undefined }),
    request('trace.face-null', { fontFace: null }),
    request('trace.ja', { lang: 'ja' }),
    request('trace.ar', { lang: 'ar' }),
    request('trace.ltr', { direction: 'ltr' }),
    request('trace.encoding', { symbolEncoding: 'Wingdings' }),
    request('trace.face', { fontFace: { family: 'Roboto', bold: false, italic: false } }),
  ];
  await injected(
    (measurement) => {
      for (const style of variants) measurement[fontCoverageProbe]('same-text', 20, style);
    },
    () =>
      scope(analysis, async (preparationReplay) => {
        const view = {
          ...baseView(),
          preparationReplay,
          coverage(text, size, style) {
            if (current && text === 'same-text') seen.push(style);
          },
        };
        analysis.faces(document, {}, view);
        current = true;
        analysis.faces(document, {}, { ...view, coverageKey: 1 });
      }),
  );
  assert.equal(analysis.stats.slides, document.slides.length);
  assert.equal(seen.length, variants.length);
  assert.deepEqual(seen, variants);
});
test('a soft negative in the original recording keeps the ordinary cold path', async () => {
  const analysis = createFontAnalysis();
  let initial = true;
  await injected(
    (measurement) => {
      try {
        measurement[fontCoverageProbe]('negative-owned', 1, request());
      } catch (error) {
        if (error.code !== 'missing-glyph') throw error;
      }
    },
    () =>
      scope(analysis, async (preparationReplay) => {
        const view = {
          ...baseView(),
          preparationReplay,
          coverage(text) {
            if (initial && text === 'negative-owned')
              throw Object.assign(Error('owned missing glyph'), { code: 'missing-glyph' });
          },
        };
        analysis.faces(document, {}, view);
        initial = false;
        analysis.faces(document, {}, { ...view, coverageKey: 1 });
      }),
  );
  assert.equal(analysis.stats.slides, 2 * document.slides.length);
});
test('script-probe-only soft codes decline replay before any later fatal request', async () => {
  for (const code of [
    'math-font-required',
    'unresolved-theme-font',
    'font-encoding-required',
    'invalid-font-family',
  ]) {
    const analysis = createFontAnalysis();
    let current = false,
      later = 0;
    await injected(
      (measurement) => {
        let covered = true;
        try {
          measurement[fontCoverageProbe]('soft-broad', 1, request());
        } catch (error) {
          if (error.code === code) covered = false;
          else throw error;
        }
        if (covered) measurement[fontCoverageProbe]('later-broad', 1, request('trace.later'));
      },
      () =>
        scope(analysis, async (preparationReplay) => {
          const view = {
            ...baseView(),
            preparationReplay,
            coverage(text) {
              if (current && text === 'soft-broad')
                throw Object.assign(Error('owned soft'), { code });
              if (current && text === 'later-broad') {
                later++;
                throw Object.assign(Error('later'), { code: 'owned-fatal' });
              }
            },
          };
          analysis.faces(document, {}, view);
          current = true;
          analysis.faces(document, {}, { ...view, coverageKey: 1 });
        }),
    );
    assert.equal(later, 0);
    assert.equal(analysis.stats.slides, 2 * document.slides.length);
  }
});

test('custom array prototypes and toJSON methods are opaque rather than executed by the guard', () => {
  let calls = 0;
  class OpaqueArray extends Array {
    toJSON() {
      calls++;
      return ['changed'];
    }
  }
  assert.equal(preparationContext(document, { catalogs: new OpaqueArray() }), undefined);
  assert.equal(
    preparationContext(document, {
      toJSON() {
        calls++;
        return {};
      },
    }),
    undefined,
  );
  assert.equal(calls, 0);
});

test('Node scripts-mode content is included in the bounded content guard', () => {
  assert.notEqual(
    preparationContext(document, { renderOptions: {}, mode: ['Arab', 'Hebr'] }),
    preparationContext(document, { renderOptions: {}, mode: ['Hebr', 'Arab'] }),
  );
});

test('guard does not normalize absent/undefined/null option content into an empty object', () => {
  assert.equal(preparationContext(document, undefined), undefined);
  assert.notEqual(preparationContext(document, null), preparationContext(document, {}));
  assert.equal(preparationContext(document, { value: undefined }), undefined);
});

test('a public Node measurement wrapper stays on the original cold callback path', async () => {
  const renderOptions = { catalogs: [gallery] },
    initial = { ...structuredClone(document), design: { fontScheme: 'roboto' } },
    next = { ...structuredClone(document), design: { fontScheme: 'open-sans' } };
  const fonts = await loadFonts({
    pack: 'office',
    substitutionPolicy: 'visual',
    scripts: 'auto',
    presentation: initial,
    renderOptions,
  });
  const originalMeasure = fonts.textMeasurement.measure;
  let calls = 0;
  fonts.textMeasurement.measure = (...args) => {
    calls++;
    return originalMeasure(...args);
  };
  const original = deckInternals.openDeck;
  let binds = 0;
  deckInternals.openDeck = (...args) => {
    const opened = original(...args);
    return {
      ...opened,
      bind(...rest) {
        binds++;
        return opened.bind(...rest);
      },
    };
  };
  try {
    await fonts.ensure(next, { renderOptions });
    assert.equal(binds, 2 * next.slides.length);
    assert.ok(calls > 0);
    assert.deepEqual(fonts.pending(next, renderOptions), []);
    assert.equal(binds, 2 * next.slides.length);
  } finally {
    deckInternals.openDeck = original;
  }
});

test('a measure replacement during an awaited face read invalidates the already captured replay', () => {
  const code = String.raw`
 import fs from 'node:fs/promises';import {registerHooks,syncBuiltinESMExports} from 'node:module';import {createHash} from 'node:crypto';
 const mode=process.argv[1];let patched=false;registerHooks({load(url,context,next){const result=next(url,context);if(mode==='disabled-guard-control'&&url.endsWith('/font-demand.js')){const source=typeof result.source==='string'?result.source:Buffer.from(result.source).toString('utf8'),needle='&&ownsStrictCoverage()';if(source.split(needle).length!==2)throw Error('guard control must patch exactly one predicate');patched=true;return {...result,source:source.replace(needle,'')};}return result;}});
 const {loadFonts}=await import(process.argv[2]),{gallery}=await import(process.argv[3]),{deckInternals}=await import(new URL('./svg-internals.js',process.argv[2])),{fontCoverageProbe}=await import(new URL('./script-fonts.js',process.argv[2]));
 const renderOptions={catalogs:[gallery]},initial={design:{fontScheme:'roboto'},slides:[{title:'Initial',text:'Body'}]},next={design:{fontScheme:'open-sans'},slides:[{title:'Next',text:'Body'}]};
 const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:initial,renderOptions});
 const originalRead=fs.readFile,originalMeasure=fonts.textMeasurement.measure,originalOpen=deckInternals.openDeck;let swapped=false,protectedFile,protectedBefore,passes=0,size40=0;
 fs.readFile=async function(file,...args){const bytes=await originalRead.call(this,file,...args);if(!swapped&&String(file).includes('OpenSans_700Bold.ttf')){swapped=true;protectedFile=file;protectedBefore=createHash('sha256').update(bytes).digest('hex');fonts.textMeasurement.measure=(text,size,style)=>{if(text==='size-owned'&&size===40){size40++;throw Object.assign(Error('size-sensitive callback'),{code:'owned-size-dependent',details:{path:style.path}});}return originalMeasure(text,size,style);};}return bytes;};syncBuiltinESMExports();
 deckInternals.openDeck=(...args)=>{const opened=originalOpen(...args);return {...opened,bind(index,measurement,...rest){if(index===0){passes++;measurement[fontCoverageProbe]('size-owned',20,{fontFamily:'Open Sans',fontWeight:400,path:'trace.size20'});measurement[fontCoverageProbe]('size-owned',40,{fontFamily:'Open Sans',fontWeight:400,path:'trace.size40'});}return opened.bind(index,measurement,...rest);}};};
 let refusal;try{await fonts.ensure(next,{renderOptions});}catch(error){refusal={code:error.code,path:error.details?.path};}finally{fs.readFile=originalRead;syncBuiltinESMExports();deckInternals.openDeck=originalOpen;}
 console.log(JSON.stringify({mode,patched,swapped,passes,size40,refusal:refusal??null,protectedBefore,protectedAfter:protectedFile?createHash('sha256').update(await originalRead(protectedFile)).digest('hex'):null}));
`;
  const run = (mode) =>
    JSON.parse(
      execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          code,
          mode,
          new URL('../dist/fonts-node.js', import.meta.url).href,
          new URL('../../gallery/dist/index.js', import.meta.url).href,
        ],
        { encoding: 'utf8', timeout: 20000, maxBuffer: 1000000 },
      ).trim(),
    );
  const unprotected = run('disabled-guard-control'),
    guarded = run('guarded');
  assert.equal(unprotected.patched, true);
  assert.equal(unprotected.swapped, true);
  assert.equal(unprotected.size40, 0);
  assert.equal(unprotected.passes, 1);
  assert.equal(unprotected.refusal, null);
  assert.equal(guarded.patched, false);
  assert.equal(guarded.swapped, true);
  assert.equal(guarded.passes, 2);
  assert.equal(guarded.size40, 1);
  assert.deepEqual(guarded.refusal, { code: 'owned-size-dependent', path: 'trace.size40' });
  for (const result of [unprotected, guarded])
    assert.equal(result.protectedBefore, result.protectedAfter);
  console.log('held read callback identity', JSON.stringify({ unprotected, guarded }));
});

test('an accessor returning the original measure still keeps the Node callback path cold', async () => {
  const renderOptions = { catalogs: [gallery] },
    initial = { ...structuredClone(document), design: { fontScheme: 'roboto' } },
    next = { ...structuredClone(document), design: { fontScheme: 'open-sans' } };
  const fonts = await loadFonts({
    pack: 'office',
    substitutionPolicy: 'visual',
    scripts: 'auto',
    presentation: initial,
    renderOptions,
  });
  const originalMeasure = fonts.textMeasurement.measure;
  let reads = 0;
  Object.defineProperty(fonts.textMeasurement, 'measure', {
    configurable: true,
    get() {
      reads++;
      return originalMeasure;
    },
  });
  const original = deckInternals.openDeck;
  let binds = 0;
  deckInternals.openDeck = (...args) => {
    const opened = original(...args);
    return {
      ...opened,
      bind(...rest) {
        binds++;
        return opened.bind(...rest);
      },
    };
  };
  try {
    await fonts.ensure(next, { renderOptions });
    assert.equal(binds, 2 * next.slides.length);
    assert.ok(reads > 0);
    assert.deepEqual(fonts.pending(next, renderOptions), []);
  } finally {
    deckInternals.openDeck = original;
  }
});
