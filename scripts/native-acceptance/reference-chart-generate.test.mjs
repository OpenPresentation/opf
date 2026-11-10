import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { titleInvariancePair, readReferenceSources } from "./reference-chart-fixtures.mjs";
import { inspectReferenceArchive, inspectReferenceTitlePair } from "./reference-chart-archive.mjs";
import { assertReferenceTitleInvariance } from "./reference-chart-generate.mjs";
import { syntheticCase, rewrite } from "./test-fixtures/reference-chart-synthetic.mjs";

test("pure title-pair inspector first proves actual fixed chart frame and XML/workbook parity; it cannot admit a one-slide physical case", () => {
  const pair = titleInvariancePair(),
    make = (document) => inspectReferenceTitlePair(syntheticCase({ document })),
    before = make(pair.before),
    after = make(pair.after);
  assert.deepEqual(assertReferenceTitleInvariance(before, after), {
    framesEqual: true,
    helperAxesLabelsAndWorkbookEqual: true,
    physicalProfileCase: false,
    scope: "Pure-export XML/workbook/geometry proof, not native paint or editability",
  });
  assert.throws(
    () => inspectReferenceArchive(syntheticCase({ document: pair.before })),
    /whole witness slide count/,
  );
  const frame = structuredClone(after);
  frame.slides[0].shapes.find((s) => s.kind === "chart").geometry.top++;
  assert.throws(() => assertReferenceTitleInvariance(before, frame), /frames identical BEFORE/);
  const axis = structuredClone(after);
  axis.slides[0].shapes.find((s) => s.kind === "chart").chart.axes[1].scaling["c:max"].val = "2000";
  assert.throws(() => assertReferenceTitleInvariance(before, axis), /title\/subtitle/);
});
test("the dedicated generator default is source inspection only and incomplete/unknown execution flags refuse before generation", () => {
  const file = fileURLToPath(new URL("./reference-chart-generate.mjs", import.meta.url)),
    summary = JSON.parse(
      execFileSync(process.execPath, [file], {
        encoding: "utf8",
        timeout: 20000,
        maxBuffer: 1000000,
      }),
    );
  assert.equal(summary.nativeAcceptance, false);
  assert.equal(summary.fullSuite, false);
  assert.equal(summary.cases.length, 3);
  assert.match(summary.exportedShapeCounts, /UNMEASURED/);
  for (const args of [["generate"], ["--run-office"], ["generate", "--consumer", "unbound"]]) {
    const out = spawnSync(process.execPath, [file, ...args], {
      encoding: "utf8",
      timeout: 20000,
      maxBuffer: 1000000,
    });
    assert.notEqual(out.status, 0);
    assert.match(out.stderr, /required|Unknown|explicit|supported/i);
  }
  assert.equal(readReferenceSources().length, 3);
});


test("title placement proof refuses internal plot layout and axis placement changes with an identical outer frame", () => {
  const pair=titleInvariancePair(),bytes=syntheticCase({document:pair.before}),before=inspectReferenceTitlePair(bytes);
  const mutants=[
    ["plot manual layout",t=>t.replace('<c:plotArea>','<c:plotArea><c:layout><c:manualLayout><c:layoutTarget val="inner"/><c:xMode val="edge"/><c:yMode val="edge"/><c:wMode val="factor"/><c:hMode val="factor"/><c:x val="0.2"/><c:y val="0.1"/><c:w val="0.6"/><c:h val="0.7"/></c:manualLayout></c:layout>')],
    ["category axis placement",t=>t.replace('<c:catAx>','<c:catAx><c:axPos val="t"/><c:crosses val="max"/><c:crossBetween val="between"/>')],
    ["axis orientation",t=>t.replace('<c:scaling>','<c:scaling><c:orientation val="maxMin"/>')],
    ["value axis placement",t=>t.replace('<c:valAx>','<c:valAx><c:axPos val="r"/><c:crossesAt val="1"/><c:tickLblPos val="high"/><c:lblOffset val="120"/>')],
  ];
  for(const[name,change]of mutants){const after=inspectReferenceTitlePair(rewrite(bytes,'ppt/charts/chart1.xml',source=>{const changed=change(source);assert.notEqual(changed,source,name+' must mutate XML');return changed;}));assert.deepEqual(before.slides[0].shapes.find(s=>s.kind==='chart').geometry,after.slides[0].shapes.find(s=>s.kind==='chart').geometry);assert.throws(()=>assertReferenceTitleInvariance(before,after),/title\/subtitle/,name);}
});
