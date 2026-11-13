import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  archiveDependencies,
  inspectSevenArchive,
  bindSevenPhase,
} from './seven-chart-archive.mjs';
import {
  SEVEN_CASES,
  SEVEN_LIMITS,
  SEVEN_SUPERVISOR,
  assertSevenSelection,
  assertSevenTitles,
  assertSevenLifecycle,
  assertSevenStages,
  compareSevenBindings,
  compareSevenImports,
  importSevenPublic,
  plainLocalPath,
  assertSevenOutput,
} from './seven-chart-profile.mjs';
import { fileIdentity } from './identity.mjs';
import { windowsPowerShellEnvironment } from './windows-powershell-env.mjs';
const here = path.dirname(fileURLToPath(import.meta.url)),
  fixture = path.join(here, 'test-fixtures/seven-chart'),
  manifest = JSON.parse(fs.readFileSync(path.join(fixture, 'manifest.json'), 'utf8')),
  deps = archiveDependencies(),
  clone = structuredClone;
const source = JSON.parse(fs.readFileSync(path.join(fixture, 'whole-seven.opf.json'), 'utf8'));
const input = (id) => fs.readFileSync(path.join(fixture, id + '.pptx'));
const suite = () => ({
  schemaVersion: 1,
  nativeAcceptance: false,
  provenance: { nativeAcceptance: false, registryAcceptance: false },
  cases: clone(manifest.cases),
});
function parts(bytes) {
  return deps.unzipSync(bytes);
}
function rewrite(bytes, fn) {
  const p = parts(bytes);
  fn(p);
  return Buffer.from(deps.zipSync(p));
}
function xml(p, file, fn) {
  p[file] = deps.strToU8(fn(deps.strFromU8(p[file])));
}
function replaceOnce(text, from, to) {
  assert.ok(text.includes(from), 'Mutant fixture must match');
  return text.replace(from, to);
}
function phaseFor(archive, branch = 'choice') {
  return {
    slideCount: 7,
    rasters: Array.from({ length: 7 }, (_, i) => ({ slideIndex: i + 1 })),
    slides: archive.slides.map((s, i) => {
      const shapes = s.shapes
        .filter((x) => x.kind === 'title' || x.branch === branch || x.branch === 'direct')
        .map((s, j) => ({
          index: j + 1,
          id: s.id,
          name: s.name,
          type: s.kind === 'title' ? 14 : 3,
          ...s.geometry,
          hasTextFrame: s.kind === 'title' ? -1 : 0,
          text: s.kind === 'title' ? s.text : null,
          alternativeText: '',
        }));
      return {
        index: i + 1,
        slideId: 256 + i,
        name: 'Synthetic ' + i,
        shapeCount: shapes.length,
        shapes,
      };
    }),
  };
}
test('four exact immutable WHOLE archives keep seven source titles, branch IDs and generic ineligibility', () => {
  assert.equal(
    manifest.originalManifestSha256,
    'fd13b7725ea3b76717ec6976c9e12a7f6df9db5135818120cc026fa54c9c5d65',
  );
  assert.deepEqual(
    manifest.cases.map((c) => c.id),
    SEVEN_CASES,
  );
  for (const f of manifest.files)
    assert.deepEqual(fileIdentity(path.join(fixture, f.path)), {
      bytes: f.bytes,
      sha256: f.sha256,
    });
  for (const id of SEVEN_CASES) {
    const b = input(id),
      s = suite(),
      { archive } = assertSevenSelection(s, id, b, Buffer.from('[]'), deps);
    assertSevenTitles(archive, source);
    assert.equal(archive.slideCount, 7);
    assert.equal(archive.logicalShapes, 14);
    assert.equal(archive.rawShapes, id.endsWith('-fallback') ? 14 : 20);
    assert.equal(s.cases.find((c) => c.id === id).automaticControlEligible, false);
    if (!id.endsWith('-fallback')) {
      for (const slide of archive.slides.slice(0, 6)) {
        const [choice, fallback] = slide.shapes.filter((s) => s.kind === 'chart');
        assert.equal(choice.name, fallback.name);
        assert.notEqual(choice.id, fallback.id);
      }
    }
  }
  assert.equal(SEVEN_LIMITS.maxShapesPerSlide, 3);
  assert.equal(SEVEN_LIMITS.maxTotalShapes, 20);
  assert.equal(SEVEN_LIMITS.maxActions, 0);
  assert.equal(SEVEN_LIMITS.maxTimeoutSeconds, 60);
  assert.equal(
    SEVEN_SUPERVISOR.sha256,
    'b9444de1367fe3a3aab654f4787b5aa9a1304dc38360159a45d1f9f420adf69c',
  );
});
test('case/action/digest/source-title/whole-slide mutations refuse without projections or cap changes', () => {
  const id = SEVEN_CASES[0],
    b = input(id);
  for (const [label, change] of [
    ['duplicate', (s) => s.cases.push(clone(s.cases[0]))],
    ['missing', (s) => s.cases.shift()],
    ['eligible', (s) => (s.cases[0].automaticControlEligible = true)],
    ['worker', (s) => (s.cases[0].worker = 'other')],
    ['six slides', (s) => (s.cases[0].slideCount = 6)],
    ['digest', (s) => (s.cases[0].archiveSha256 = '0'.repeat(64))],
    ['native accepted', (s) => (s.nativeAcceptance = true)],
  ]) {
    const s = suite();
    change(s);
    assert.throws(() => assertSevenSelection(s, id, b, Buffer.from('[]'), deps), label);
  }
  assert.throws(() =>
    assertSevenSelection(suite(), id, b, Buffer.from('[{"action":"edit"}]'), deps),
  );
  assert.throws(() => assertSevenSelection(suite(), 'projection', b, Buffer.from('[]'), deps));
  const titleChanged = rewrite(b, (p) =>
    xml(p, 'ppt/slides/slide1.xml', (t) =>
      t.replace(/<a:t>([^<]*)<\/a:t>/u, '<a:t>$1 changed</a:t>'),
    ),
  );
  assert.throws(
    () => assertSevenTitles(inspectSevenArchive(titleChanged, deps), source),
    /title\/order/u,
  );
  const extra = rewrite(b, (p) => {
    p['ppt/slides/slide8.xml'] = p['ppt/slides/slide1.xml'];
  });
  assert.throws(() => inspectSevenArchive(extra, deps), /Hidden\/unreferenced/u);
  assert.throws(() => inspectSevenArchive(Buffer.alloc(16 * 1024 * 1024 + 1), deps), /16MiB/u);
  const duplicate = rewrite(b, (p) => {
    p['PPT/slides/slide1.xml'] = p['ppt/slides/slide1.xml'];
  });
  assert.throws(() => inspectSevenArchive(duplicate, deps), /Duplicate ZIP/u);
});
test('real Choice/Fallback identity and cx2 funnel namespaces determine branch, never shared chart name', () => {
  const b = input(SEVEN_CASES[0]),
    a = inspectSevenArchive(b, deps),
    choice = bindSevenPhase(a, phaseFor(a)),
    fallback = bindSevenPhase(a, phaseFor(a, 'fallback'));
  assert.equal(choice[0].shapes.find((s) => s.kind === 'chart').branch, 'choice');
  assert.equal(fallback[0].shapes.find((s) => s.kind === 'chart').branch, 'fallback');
  assert.equal(choice[6].shapes.find((s) => s.kind === 'chart').branch, 'direct');
  const wrong = phaseFor(a);
  wrong.slides[0].shapes[1].id = 987654;
  assert.throws(() => bindSevenPhase(a, wrong), /ID\/name/u);
  const title = phaseFor(a);
  title.slides[0].shapes[0].text += ' missing';
  assert.throws(() => bindSevenPhase(a, title), /title words/u);
  const geometry = phaseFor(a);
  geometry.slides[1].shapes[1].width = NaN;
  assert.throws(() => bindSevenPhase(a, geometry), /descriptor/u);
  const p = parts(b),
    funnel = Object.keys(p).find(
      (k) =>
        /^ppt\/slides\/slide\d+\.xml$/u.test(k) && deps.strFromU8(p[k]).includes('Requires="cx2"'),
    );
  assert.ok(funnel, 'Original funnel is cx2');
  xml(p, funnel, (t) => replaceOnce(t, '2015/10/21/chartex', '2015/9/8/chartex'));
  assert.throws(() => inspectSevenArchive(Buffer.from(deps.zipSync(p)), deps));
  const branch = rewrite(b, (p) =>
    xml(p, 'ppt/slides/slide1.xml', (t) => t.replace(/Requires="cx1"/u, 'Requires="unknown"')),
  );
  assert.throws(() => inspectSevenArchive(branch, deps), /feature/u);
  const rel = rewrite(b, (p) =>
    xml(p, 'ppt/slides/_rels/slide1.xml.rels', (t) =>
      t.replace(/Target="([^"]+chart[^"]+)"/u, 'Target="$1" TargetMode="External"'),
    ),
  );
  assert.throws(() => inspectSevenArchive(rel, deps), /External/u);
});
test('Choice Requires resolves ancestor namespaces and rejects missing, foreign or shadowed bindings', () => {
  const b = input(SEVEN_CASES[0]), original = inspectSevenArchive(b, deps);
  const first = 'ppt/slides/slide1.xml';
  const uri = 'http://schemas.microsoft.com/office/drawing/2015/9/8/chartex';
  const declaration = 'xmlns:cx1="' + uri + '"';
  function hoist(target, extra = '') {
    return rewrite(b, p => xml(p, first, t => {
      t = replaceOnce(t, ' ' + declaration, '');
      return replaceOnce(t, '<' + target, '<' + target + ' ' + declaration + extra);
    }));
  }
  // Model the actual saved Office spelling, then the other legal ancestor levels.
  for (const target of ['mc:AlternateContent', 'p:spTree', 'p:cSld', 'p:sld'])
    assert.deepEqual(inspectSevenArchive(hoist(target), deps), original, target);
  const funnel = Object.keys(parts(b)).find(file => /^ppt\/slides\/slide\d+\.xml$/u.test(file)
    && deps.strFromU8(parts(b)[file]).includes('Requires="cx2"'));
  assert.ok(funnel);
  const funnelHoisted = rewrite(b, p => xml(p, funnel, t => {
    const declaration = / xmlns:cx2="[^"]+"/u.exec(t)?.[0];
    assert.ok(declaration);
    return replaceOnce(replaceOnce(t, declaration, ''), '<mc:AlternateContent',
      '<mc:AlternateContent' + declaration);
  }));
  assert.deepEqual(inspectSevenArchive(funnelHoisted, deps), original);
  for (const change of [
    t => replaceOnce(t, ' ' + declaration, ''),
    t => replaceOnce(t, declaration, 'xmlns:cx1="urn:foreign"'),
    t => replaceOnce(t, declaration, 'xmlns:cx1=""'),
    t => replaceOnce(t, 'Requires="cx1"', 'Requires="cx1 cx1"'),
    t => replaceOnce(t, 'Requires="cx1"', 'Requires="cx1 cx2"'),
    t => replaceOnce(t, declaration, declaration + ' ' + declaration),
  ]) assert.throws(() => inspectSevenArchive(rewrite(b, p => xml(p, first, change)), deps));
  const inherited = hoist('mc:AlternateContent');
  const shadowed = rewrite(inherited, p => xml(p, first, t =>
    replaceOnce(t, '<mc:Choice ', '<mc:Choice xmlns:cx1="urn:foreign" ')));
  assert.throws(() => inspectSevenArchive(shadowed, deps));
  const sibling = rewrite(b, p => xml(p, first, t =>
    replaceOnce(replaceOnce(t, ' ' + declaration, ''), '<mc:Fallback',
      '<mc:Fallback ' + declaration)));
  assert.throws(() => inspectSevenArchive(sibling, deps), 'Fallback declaration is outside Choice scope');
  const nearerValid = rewrite(b, p => xml(p, first, t =>
    replaceOnce(t, '<mc:AlternateContent', '<mc:AlternateContent xmlns:cx1="urn:foreign"')));
  assert.deepEqual(inspectSevenArchive(nearerValid, deps).slides, original.slides,
    'A correct local binding takes precedence over a foreign ancestor');
});
test('actual cache and workbook mutants cannot hide inconsistent values; coherent data changes remain findings', () => {
  const b = input(SEVEN_CASES[1]),
    before = inspectSevenArchive(b, deps),
    chart = before.slides[0].shapes.find((s) => s.kind === 'chart'),
    file = chart.chartPart,
    series = chart.chart.series[0],
    values = series['c:val'].values;
  const first = values[0],
    next = first + 1,
    formula = series['c:val'].formula,
    cell = /!\$([A-Z]+)\$([0-9]+)/u.exec(formula);
  assert.ok(cell);
  const cacheChanged = rewrite(b, (p) =>
    xml(p, file, (t) => {
      const re = new RegExp('(<c:numCache>[\\s\\S]*?<c:v>)' + first + '(</c:v>)', 'u');
      assert.match(t, re);
      return t.replace(re, '$1' + next + '$2');
    }),
  );
  assert.throws(() => inspectSevenArchive(cacheChanged, deps), /cache\/workbook mismatch/u);
  const workbookChanged = rewrite(b, (p) => {
    const nested = parts(p[chart.chart.workbook.part]),
      sheet = Object.keys(nested).find((k) => /^xl\/worksheets\/sheet[0-9]+\.xml$/u.test(k));
    xml(nested, sheet, (t) => {
      const re = new RegExp(
        '(<c\\b[^>]*r="' + cell[1] + cell[2] + '"[^>]*>[\\s\\S]*?<v>)' + first + '(</v>)',
        'u',
      );
      assert.match(t, re);
      return t.replace(re, '$1' + next + '$2');
    });
    p[chart.chart.workbook.part] = deps.zipSync(nested);
  });
  assert.throws(() => inspectSevenArchive(workbookChanged, deps), /cache\/workbook mismatch/u);
  const a = bindSevenPhase(before, phaseFor(before));
  const after = clone(a);
  after[0].shapes.find((s) => s.kind === 'chart').chart.series[0]['c:val'].values[0] = next;
  assert.equal(compareSevenBindings(a, after)[0].code, 'exposed-cache-or-workbook-changed');
  const family = clone(a);
  family[1].shapes.find((s) => s.kind === 'chart').uri = 'changed-family';
  assert.ok(compareSevenBindings(a, family).some((f) => f.code === 'exposed-chart-family-changed'));
});
test('public import differences retain numeric changes, synthetic Row topology, titles and diagnostics', () => {
  const imports = {
    original: { document: clone(source), diagnostics: [] },
    'saved-reopened': { document: clone(source), diagnostics: [] },
  };
  assert.deepEqual(compareSevenImports(source, imports), []);
  const rows = clone(imports);
  rows['saved-reopened'].document.slides[0].chart.data.columns.unshift({ name: 'Row' });
  rows['saved-reopened'].document.slides[0].chart.data.rows.forEach((row, i) => {
    row.unshift(String(i + 1));
  });
  const f = compareSevenImports(source, rows);
  assert.ok(f.some((x) => x.code === 'import-authored-data-differs'));
  assert.ok(f.some((x) => x.code === 'saved-public-import-differs'));
  const title = clone(imports);
  title['saved-reopened'].document.slides[2].title += ' changed';
  assert.ok(
    compareSevenImports(source, title).some((x) => x.code === 'saved-public-import-differs'),
  );
  const diagnostics = clone(imports);
  diagnostics['saved-reopened'].diagnostics.push({ code: 'actual-new-warning' });
  assert.ok(
    compareSevenImports(source, diagnostics).some(
      (x) => x.code === 'saved-public-import-diagnostics-differ',
    ),
  );
  const dropped = clone(imports);
  dropped['saved-reopened'].document.slides.pop();
  assert.throws(() => compareSevenImports(source, dropped), /lost a slide/u);
});
test('failed/partial lifecycles never count as successful observations', () => {
  const phase = {
    slideCount: 7,
    slides: Array.from({ length: 7 }, () => ({})),
    rasters: Array.from({ length: 7 }, () => ({})),
  };
  const report = {
      schemaVersion: 2,
      profile: 'seven-chart-original-readonly-v2',
      envelopeSha256: 'b'.repeat(64),
      sourceSha256: 'a'.repeat(64),
      cleanupConfirmed: true,
      officeOperationsStopped: false,
      error: null,
      lastStage: 'worker.complete',
      lastStatus: 'success',
      actions: [],
      opens: [
        { phase: 'original', readOnly: -1 },
        { phase: 'saved-reopened', readOnly: -1 },
      ],
      closes: 2,
      saveCopies: 1,
      quits: 1,
      phases: { original: clone(phase), 'saved-reopened': clone(phase) },
    },
    terminal = { timedOut: false, exitCode: 0, cleanupConfirmed: true };
  assertSevenLifecycle(report, terminal, 'a'.repeat(64), 'b'.repeat(64));
  for (const mutate of [
    (r) => { r.schemaVersion = 1; r.profile = 'seven-chart-original-readonly-v1'; },
    (r) => (r.officeOperationsStopped = true),
    (r) => (r.cleanupConfirmed = false),
    (r) => (r.closes = 1),
    (r) => (r.saveCopies = 2),
    (r) => (r.opens[0].readOnly = 0),
    (r) => r.actions.push({ edit: true }),
    (r) => r.phases.original.rasters.pop(),
    (r) => delete r.phases['saved-reopened'],
  ]) {
    const r = clone(report);
    mutate(r);
    assert.throws(() => assertSevenLifecycle(r, terminal, 'a'.repeat(64), 'b'.repeat(64)));
  }
  for (const t of [
    { ...terminal, timedOut: true },
    { ...terminal, exitCode: 1 },
    { ...terminal, cleanupConfirmed: false },
  ])
    assert.throws(() => assertSevenLifecycle(report, t, 'a'.repeat(64), 'b'.repeat(64)));
});
test('actual worker definitions stop after managed getter/method/primitive/ownership faults; no Office factory', {
  skip:
    process.platform !== 'win32'
      ? 'Managed Windows PowerShell5.1 contract; portable archive/import controls above run on every OS'
      : false,
}, () => {
  const output = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'opf-seven-managed-')));
  const owned = path.join(output, 'results');
  try {
    const r = spawnSync(
      path.join(process.env.WINDIR, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
      [
        '-NoProfile',
        '-NonInteractive',
        '-File',
        path.join(here, 'seven-chart-worker-self-test.ps1'),
        '-Worker',
        path.join(here, 'seven-chart-worker.ps1'),
        '-Output',
        owned,
      ],
      {
        encoding: 'utf8',
        env: windowsPowerShellEnvironment(process.env),
        timeout: 150000,
        maxBuffer: 8 * 1024 * 1024,
      },
    );
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const facts = JSON.parse(
      fs.readFileSync(path.join(owned, 'mock-results.json'), 'utf8').replace(/^\uFEFF/u, ''),
    );
    assert.equal(facts.mockOnly, true);
    assert.equal(facts.officeInvoked, false);
    assert.equal(facts.cases, 55);
    assert.ok(facts.results.every((x) => x.passed));
    assert.ok(!facts.baselineCalls.some((x) => x.startsWith('FORBIDDEN.')));
    const report = JSON.parse(
      fs.readFileSync(path.join(owned, 'success/report.json'), 'utf8').replace(/^\uFEFF/u, ''),
    );
    const stages = fs
      .readFileSync(path.join(owned, 'success/stages.jsonl'), 'utf8')
      .trim()
      .split(/\r?\n/u)
      .map((s) => JSON.parse(s.replace(/^\uFEFF/u, '')));
    assertSevenStages(report, stages);
    for (const change of [
      (s) => s.splice(4, 1),
      (s) => s[3].sequence++,
      (s) => (s[4].status = 'error'),
      (s) => (s[5].officeOperationsStopped = true),
      (s) => (s[6].stage = 'forbidden.Chart'),
    ]) {
      const bad = clone(stages);
      change(bad);
      assert.throws(() => assertSevenStages(report, bad));
    }
  } finally {
    const full = path.resolve(output);
    assert.ok(full.startsWith(fs.realpathSync(os.tmpdir()) + path.sep));
    fs.rmSync(full, { recursive: true, force: true });
  }
});

test('controller paths reject aliases and output overlap with every immutable source/runtime root', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'opf-seven-paths-')));
  try {
    const names = ['suite', 'producer', 'worker', 'consumer', 'controller'];
    for (const name of names) fs.mkdirSync(path.join(root, name));
    const envelope = {
      generation: {
        suiteDirectory: path.join(root, 'suite'),
        preparationRepository: path.join(root, 'producer'),
        workerRepository: path.join(root, 'worker'),
        consumer: path.join(root, 'consumer'),
      },
      controllerRepository: { directory: path.join(root, 'controller') },
    };
    assert.equal(assertSevenOutput(path.join(root, 'fresh'), envelope), path.join(root, 'fresh'));
    for (const name of names)
      for (const candidate of [path.join(root, name), path.join(root, name, 'child'), root])
        assert.throws(() => assertSevenOutput(candidate, envelope), /overlaps/u);
    assert.throws(() => plainLocalPath('relative/path'));
    const alias = path.join(root, 'alias');
    fs.symlinkSync(
      path.join(root, 'suite'),
      alias,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    assert.throws(() => plainLocalPath(alias), /Reparse\/symlink/u);
    fs.unlinkSync(alias);
  } finally {
    assert.ok(path.resolve(root).startsWith(fs.realpathSync(os.tmpdir()) + path.sep));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the public-import adapter passes the named Gallery catalog and preserves actual diagnostics', async () => {
  const catalog = { source: 'https://synthetic.example/catalog' },
    calls = [],
    warning = { code: 'synthetic-visible-finding' };
  const engines = {
    gallery: catalog,
    pptx: {
      fromPptx(bytes, options) {
        calls.push({ bytes, options });
        options.onDiagnostic(warning);
        return structuredClone(source);
      },
    },
  };
  const bytes = Buffer.from('synthetic adapter contract');
  const result = await importSevenPublic(bytes, { engines });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].bytes, bytes);
  assert.deepEqual(calls[0].options.catalogs, [catalog]);
  assert.deepEqual(result.diagnostics, [warning]);
  assert.deepEqual(result.document, source);
  await assert.rejects(
    () => importSevenPublic(bytes, { engines: { ...engines, gallery: { gallery: catalog } } }),
    /named registered Gallery/u,
  );
  await assert.rejects(
    () =>
      importSevenPublic(bytes, {
        engines: { ...engines, pptx: { fromPptx: () => ({ slides: [] }) } },
      }),
    /lost a slide/u,
  );
});
