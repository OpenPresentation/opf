// Deliberately synthetic XML/packages for pure controller tests; never renderer or Office evidence.
import assert from "node:assert/strict";
import test from "node:test";
import { inspectReferenceArchive, bindReferenceWitnessPhase } from "./reference-chart-archive.mjs";
import {
  REFERENCE_LIMITS,
  assertReferenceWitnessLifecycle,
  assertReferenceWitnessPostflight,
  assertReferenceWitnessSelection,
  assertReferenceWitnessSource,
  compareReferenceWitnessImports,
  compareReferenceWitnessBindings,
  importReferenceWitnessPublic,
} from "./reference-chart-profile.mjs";
import {
  syntheticCase,
  phaseFor,
  rewrite,
  suite,
  deps,
  sources,
} from "./test-fixtures/reference-chart-synthetic.mjs";
import { resolveChartData } from "../../packages/javascript/dist/index.js";
const compareImports = (source, imported, canvas) => compareReferenceWitnessImports(source, imported, canvas, resolveChartData);
const clone = structuredClone;
test("synthetic direct classic archives preserve all twelve source charts, helpers, workbooks, raw caps and exact source contracts", () => {
  assert.equal(REFERENCE_LIMITS.maxShapesPerSlide, 3);
  assert.equal(REFERENCE_LIMITS.maxTotalShapes, 9);
  assert.equal(REFERENCE_LIMITS.maxTimeoutSeconds, 60);
  for (const source of sources) {
    const bytes = syntheticCase(source),
      checked = assertReferenceWitnessSelection(
        suite(bytes),
        source.id,
        bytes,
        Buffer.from("[]"),
        deps,
      );
    assertReferenceWitnessSource(checked.archive, source.document);
    assert.equal(checked.archive.slideCount, 3);
    assert.ok(checked.archive.rawShapes <= 9);
    const bound = bindReferenceWitnessPhase(checked.archive, phaseFor(checked.archive));
    assert.deepEqual(compareReferenceWitnessBindings(bound, bound), []);
  }
});
test("closed selection, generic ineligibility, source topology and zero actions are never inferred or projected", () => {
  const bytes = syntheticCase(sources[0]);
  for (const change of [
    (s) => s.cases.pop(),
    (s) => s.cases.reverse(),
    (s) => (s.cases[0].automaticControlEligible = true),
    (s) => (s.cases[0].slideCount = 2),
    (s) => (s.cases[0].archiveSha256 = "0".repeat(64)),
    (s) => (s.fullSuite = true),
  ]) {
    const s = suite(bytes);
    change(s);
    assert.throws(() =>
      assertReferenceWitnessSelection(s, sources[0].id, bytes, Buffer.from("[]"), deps),
    );
  }
  assert.throws(() =>
    assertReferenceWitnessSelection(suite(bytes), "projection", bytes, Buffer.from("[]"), deps),
  );
  assert.throws(() =>
    assertReferenceWitnessSelection(
      suite(bytes),
      sources[0].id,
      bytes,
      Buffer.from('[{"action":"edit"}]'),
      deps,
    ),
  );
  const archive = inspectReferenceArchive(bytes, deps),
    source = clone(sources[0].document);
  source.slides[0].chart.data.rows[0][1]++;
  assert.throws(() => assertReferenceWitnessSource(archive, source), /numeric/);
  source.slides[0].chart.data.rows[0][1]--;
  source.slides[0].chart.referenceLines[0].value++;
  assert.throws(() => assertReferenceWitnessSource(archive, source), /raw reference/);
});
test("cache, workbook, helper ownership, label, title, grouping, paint and relationship mutations refuse pure admission", () => {
  const source = sources[0],
    bytes = syntheticCase(source);
  const mutants = [
    ["ppt/charts/chart1.xml", (t) => t.replace("<c:v>80</c:v>", "<c:v>81</c:v>")],
    ["ppt/charts/chart1.xml", (t) => t.replace('val="19050"', 'val="19051"')],
    ["ppt/charts/chart1.xml", (t) => t.replace("<a:t>Target 80</a:t>", "<a:t>Other</a:t>")],
    ["ppt/slides/slide3.xml", (t) => t.replace("Target 92%", "Target 99%")],
    [
      "ppt/slides/slide1.xml",
      (t) =>
        t
          .replace("<p:graphicFrame>", "<mc:AlternateContent><p:graphicFrame>")
          .replace("</p:graphicFrame>", "</p:graphicFrame></mc:AlternateContent>"),
    ],
    [
      "ppt/charts/_rels/chart1.xml.rels",
      (t) => t.replace('Target="../embeddings/', 'TargetMode="External" Target="../embeddings/'),
    ],
    ["ppt/charts/chart1.xml", (t) => t.replace(/<c:extLst>[\s\S]*?<\/c:extLst>/, "")],
  ];
  for (const [file, change] of mutants)
    assert.throws(
      () =>
        assertReferenceWitnessSource(
          inspectReferenceArchive(rewrite(bytes, file, change), deps),
          source.document,
        ),
      file,
    );
  const parts = deps.unzipSync(bytes);
  parts["ppt/slides/slide4.xml"] = parts["ppt/slides/slide1.xml"];
  assert.throws(() => inspectReferenceArchive(deps.zipSync(parts), deps), /Unreferenced/);
  const invalidTitle = clone(inspectReferenceArchive(bytes, deps));
  invalidTitle.slides[0].shapes[0].chart.groups.at(-1).grouping = "stacked";
  assert.throws(() => assertReferenceWitnessSource(invalidTitle, source.document), /grouping/);
});
test("native binding resolves exact IDs and words, never a same-name duplicate or changed shape topology", () => {
  const archive = inspectReferenceArchive(syntheticCase(sources[2]), deps);
  for (const mutate of [
    (p) => p.slides[1].shapes[1].id++,
    (p) => (p.slides[1].shapes[2].text = "Wrong label"),
    (p) => p.slides[1].shapes.pop(),
    (p) => p.rasters.pop(),
  ]) {
    const phase = phaseFor(archive);
    mutate(phase);
    assert.throws(() => bindReferenceWitnessPhase(archive, phase));
  }
});
test("public import comparison exposes helper data, dropped references, current edits and duplicate visible overlays", async () => {
  const document = clone(sources[0].document),
    sourceCanvas = inspectReferenceArchive(syntheticCase(sources[0]), deps).canvas,
    scale = Math.min(sourceCanvas.cx, sourceCanvas.cy) / 6858000;
  for (const slide of document.slides)
    for (const ref of slide.chart.referenceLines ?? [])
      ref.stroke = {
        color: "#123456",
        ...ref.stroke,
        width: Math.min(64, Math.round(((ref.stroke?.width ?? 4 / 3) * scale) * 9525) / (9525 * scale)),
        dash: ref.stroke?.dash ?? "dash",
      };
  const imported = {
    original: { document: clone(document), diagnostics: [] },
    "saved-reopened": { document: clone(document), diagnostics: [] },
  };
  assert.deepEqual(compareImports(sources[0].document, imported, sourceCanvas), []);
  for (const mutate of [
    (d) => d.slides[0].chart.data.columns.push("Unintended helper"),
    (d) => d.slides[0].chart.referenceLines.pop(),
    (d) => d.slides[0].chart.referenceLines[0].value++,
    (d) => (d.slides[0].shapes = [{ type: "line" }]),
  ]) {
    const changed = clone(imported);
    mutate(changed["saved-reopened"].document);
    assert.ok(compareImports(sources[0].document, changed, sourceCanvas).length);
  }
  const gallery = { source: "https://synthetic.invalid/catalog" },
    warning = { code: "synthetic-uncertainty" },
    out = await importReferenceWitnessPublic(Buffer.from("synthetic"), {
      engines: {
        gallery,
        pptx: {
          fromPptx(_bytes, o) {
            assert.deepEqual(o.catalogs, [gallery]);
            o.onDiagnostic(warning);
            return document;
          },
        },
      },
    });
  assert.deepEqual(out.diagnostics, [warning]);
  assert.deepEqual(out.document, document);
});
test("workbook mutations and changed native geometry remain explicit findings, never silent paint acceptance", () => {
  const bytes = syntheticCase(sources[0]),
    parts = deps.unzipSync(bytes),
    book = deps.unzipSync(parts["ppt/embeddings/book1.xlsx"]);
  const sheet = deps.strFromU8(book["xl/worksheets/sheet1.xml"]);
  assert.ok(sheet.includes("<v>40</v>"));
  book["xl/worksheets/sheet1.xml"] = deps.strToU8(sheet.replace("<v>40</v>", "<v>41</v>"));
  parts["ppt/embeddings/book1.xlsx"] = deps.zipSync(book);
  assert.throws(() => inspectReferenceArchive(deps.zipSync(parts), deps), /cache\/workbook/);
  const archive = inspectReferenceArchive(bytes, deps),
    before = bindReferenceWitnessPhase(archive, phaseFor(archive)),
    after = clone(before);
  after[0].shapes[0].geometry.left++;
  assert.ok(
    compareReferenceWitnessBindings(before, after).some(
      (f) => f.code === "native-geometry-or-shape-topology-changed",
    ),
  );
});
test("failed/partial lifecycles never count as successful observations", () => {
  const phase = {
    slideCount: 3,
    slides: Array.from({ length: 3 }, () => ({})),
    rasters: Array.from({ length: 3 }, () => ({})),
  };
  const report = {
      schemaVersion: 1,
      profile: "reference-chart-original-readonly-v1",
      envelopeSha256: "b".repeat(64),
      sourceSha256: "a".repeat(64),
      cleanupConfirmed: true,
      officeOperationsStopped: false,
      error: null,
      lastStage: "worker.complete",
      lastStatus: "success",
      actions: [],
      opens: [
        { phase: "original", readOnly: -1 },
        { phase: "saved-reopened", readOnly: -1 },
      ],
      closes: 2,
      saveCopies: 1,
      quits: 1,
      phases: { original: clone(phase), "saved-reopened": clone(phase) },
    },
    terminal = { timedOut: false, exitCode: 0, cleanupConfirmed: true };
  assertReferenceWitnessLifecycle(report, terminal, "a".repeat(64), "b".repeat(64));
  for (const mutate of [
    (r) => (r.officeOperationsStopped = true),
    (r) => (r.cleanupConfirmed = false),
    (r) => (r.closes = 1),
    (r) => (r.saveCopies = 2),
    (r) => (r.opens[0].readOnly = 0),
    (r) => r.actions.push({ edit: true }),
    (r) => r.phases.original.rasters.pop(),
    (r) => delete r.phases["saved-reopened"],
  ]) {
    const r = clone(report);
    mutate(r);
    assert.throws(() =>
      assertReferenceWitnessLifecycle(r, terminal, "a".repeat(64), "b".repeat(64)),
    );
  }
  for (const t of [
    { ...terminal, timedOut: true },
    { ...terminal, exitCode: 1 },
    { ...terminal, cleanupConfirmed: false },
  ])
    assert.throws(() => assertReferenceWitnessLifecycle(report, t, "a".repeat(64), "b".repeat(64)));
});


test('postflight receipt preserves initial nonzero samples and requires a fresh zero before the fixed deadline', () => {
  const samples = [
    {schemaVersion:1,sequence:1,utc:'2026-11-10T00:00:00.000Z',elapsedMilliseconds:0,status:'observed',processIds:[6328],error:null},
    {schemaVersion:1,sequence:2,utc:'2026-11-10T00:00:00.100Z',elapsedMilliseconds:100,status:'observed',processIds:[6328],error:null},
    {schemaVersion:1,sequence:3,utc:'2026-11-10T00:00:00.200Z',elapsedMilliseconds:200,status:'observed',processIds:[],error:null},
  ];
  const terminal = {workerCleanupConfirmed:true,postflightError:null,powerPointPostflightInitialCount:1,powerPointPostflightCount:0,postflight:{schemaVersion:1,policy:'global-zero-after-completed-owned-quit-v1',budgetMilliseconds:5000,intervalMilliseconds:100,maximumQueries:51,sampleCount:3,initialProcessIds:[6328],initialCount:1,finalProcessIds:[],finalCount:0,elapsedMilliseconds:200,finishedElapsedMilliseconds:201,observedZero:true,officeActions:0}};
  assertReferenceWitnessPostflight(terminal,samples);
  for (const mutate of [
    (t,r)=>{r[1].processIds=[9999];},
    (t,r)=>{r[1].sequence=3;},
    (t,r)=>{r[1].elapsedMilliseconds=-1;},
    (t,r)=>{r[2].elapsedMilliseconds=5000;t.postflight.elapsedMilliseconds=5000;},
    (t,r)=>{r[2].elapsedMilliseconds=NaN;},
    (t,r)=>{r[0].processIds=[];},
    (t,r)=>{r[1].processIds=[6328,6328];},
    (t,r)=>{r[1].processIds=[0];},
    (t,r)=>{r[1].utc='not-a-timestamp';},
    (t,r)=>{r[1].status='failed';},
    t=>{t.postflight.finishedElapsedMilliseconds=5000;},
    t=>{t.postflight.finishedElapsedMilliseconds=199;},
    t=>{t.postflight.finishedElapsedMilliseconds=NaN;},
    t=>{delete t.postflight.finishedElapsedMilliseconds;},
    t=>{t.postflight.sampleCount=2;},
    t=>{t.postflight.budgetMilliseconds=5001;},
    t=>{t.postflight.intervalMilliseconds=99;},
    t=>{t.workerCleanupConfirmed=false;},
    t=>{t.postflightError='query failed';},
    t=>{t.powerPointPostflightInitialCount=0;},
  ]) {
    const t=clone(terminal),r=clone(samples);mutate(t,r);assert.throws(()=>assertReferenceWitnessPostflight(t,r));
  }
});

test('fourth singleton case stays whole and binds both IDs to the current own-axis group without a shape-cap increase',()=>{const source=sources[3],archive=inspectReferenceArchive(syntheticCase(source),deps);assert.equal(source.id,'reference-singleton-axes');assert.deepEqual(archive.slides.map(s=>s.shapes.length),[3,3,1]);assert.equal(archive.rawShapes,7);assertReferenceWitnessSource(archive,source.document);for(const mode of['missing','wrong','duplicate','overflow','swapped-group','nonreciprocal','own-bounds']){const changed=clone(archive),chart=changed.slides[0].shapes.find(s=>s.kind==='chart').chart,owner=chart.ownership.overlays[0];if(mode==='missing')delete owner.axisIds;else if(mode==='wrong')owner.axisIds.value=40;else if(mode==='duplicate')owner.axisIds.category=owner.axisIds.value;else if(mode==='overflow')owner.axisIds.value=4294967296;else if(mode==='swapped-group')chart.groups[0].axes=['30','40'];else if(mode==='nonreciprocal')chart.axes.find(a=>a.id==='10').cross='40';else chart.axes.find(a=>a.id==='20').scaling['c:max'].val='100';assert.throws(()=>assertReferenceWitnessSource(changed,source.document),undefined,mode);}const five=structuredClone(source);five.document.slides[0].chart.referenceLines.forEach((r,i)=>{r.label='extra'+i;});assert.throws(()=>inspectReferenceArchive(syntheticCase(five),deps),/shape cap/);});

for (const [index, name] of ['both-axis','secondary-only','no-reference-control'].entries()) test('coherently collapsed singleton '+name+' group and ownership refuse even with a valid unused second pair',()=>{
  const source=sources[3], original=syntheticCase(source);
  const mutant=rewrite(original,'ppt/charts/chart'+(index+1)+'.xml',xml=>{
    let changed=xml.replace(/<c:lineChart>[\s\S]*?<\/c:lineChart>/,group=>{assert.match(group,/<c:axId val="30"\/><c:axId val="40"\/>/);return group.replace('<c:axId val="30"/><c:axId val="40"/>','<c:axId val="10"/><c:axId val="20"/>');});
    changed=changed.replace(/(<opf:references data=")([A-F0-9]+)(")/,(_m,a,h,b)=>{const record=JSON.parse(Buffer.from(h,'hex').toString());for(const owned of record.overlays)if(owned.axis==='secondary')owned.axisIds={category:10,value:20};return a+Buffer.from(JSON.stringify(record)).toString('hex').toUpperCase()+b;});
    return changed;
  });
  const archive=inspectReferenceArchive(mutant,deps),chart=archive.slides[index].shapes.find(s=>s.kind==='chart').chart;
  assert.deepEqual(chart.axes.map(a=>a.id).sort(),['10','20','30','40']);
  assert.ok(chart.groups.every(g=>JSON.stringify(g.axes)===JSON.stringify(['10','20'])));
  for(const owned of chart.ownership?.overlays??[])if(owned.axis==='secondary')assert.deepEqual(owned.axisIds,{category:10,value:20});
  assert.throws(()=>assertReferenceWitnessSource(archive,source.document),/distinct/);
});
