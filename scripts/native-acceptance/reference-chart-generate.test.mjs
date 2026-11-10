import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { titleInvariancePair, readReferenceSources } from "./reference-chart-fixtures.mjs";
import { inspectReferenceArchive, inspectReferenceTitlePair } from "./reference-chart-archive.mjs";
import { assertReferenceTitleInvariance } from "./reference-chart-generate.mjs";
import { syntheticCase } from "./test-fixtures/reference-chart-synthetic.mjs";

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
