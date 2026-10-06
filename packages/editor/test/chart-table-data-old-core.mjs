// RR-54: the editor still edits documents that use none of the chart and table data contract when the installed core predates it. This runs
// test/fixtures/old-core/body.mjs in a child process where `@openpresentation/opf` has none of core's RR-54 exports (a shim of the real
// package without them), and asserts it exits cleanly: the number format, detach and display paths report a reason instead of throwing a TypeError.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const real = await import("@openpresentation/opf");
const realUrl = import.meta.resolve("@openpresentation/opf");
const RR54 = ["chartNumber", "formatDataNumber", "numberFormatError", "excelNumberFormat", "numberFormatFromExcel", "inlineDatasets", "inlineTableData", "inlineChartData", "resolveChartData", "resolveTableData", "tableCellDisplayValue", "datasetDiagnostics", "unusedDatasets", "isXYChartType", "isDatasetRef"];
const names = Object.keys(real).filter((name) => !RR54.includes(name) && name !== "default" && /^[A-Za-z_$][\w$]*$/.test(name));
const dir = mkdtempSync(path.join(os.tmpdir(), "opf-old-core-"));
try {
  const shim = path.join(dir, "opf-shim.mjs");
  writeFileSync(shim, `import * as real from ${JSON.stringify(realUrl)};\n${names.map((name) => `export const ${name} = real.${name};`).join("\n")}\n`);
  const body = fileURLToPath(new URL("./fixtures/old-core/child.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [body], { encoding: "utf8", env: { ...process.env, OPF_OLD_CORE_SHIM: pathToFileURL(shim).href } });
  assert.equal(result.status, 0, `the old-core child failed:\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /old core ok/);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log("Chart and table data (editor): without core's RR-54 exports the grid still edits plain documents and reports a reason instead of throwing.");
