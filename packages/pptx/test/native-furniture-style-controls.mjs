// Source policy plus the maintained AST-only mock checker on Windows. No Office object is constructed.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanPowerShellSource } from "./powershell-scan.mjs";

const worker = new URL("native-furniture-control.ps1", import.meta.url);
const checker = new URL("native-furniture-harness-check.ps1", import.meta.url);
for (const file of [
	worker,
	checker,
	new URL("native-font-property-probe.ps1", import.meta.url),
]) {
	const result = scanPowerShellSource(readFileSync(file, "utf8"));
	assert.deepEqual(result.issues, [], `${file}: modeled source-policy syntax`);
}
const source = readFileSync(worker, "utf8");
assert.match(source, /\[switch\]\$CaptureTextFonts/);
assert.match(
	source,
	/if\(\$CaptureTextFonts\) \{ \$workerArguments\+='-CaptureTextFonts' \}/,
);
assert.match(source, /captureTextFonts=\[bool\]\$CaptureTextFonts/g);
assert.match(
	source,
	/if\(\$CaptureTextFonts\) \{ \$shapeRecord\.textFont=Read-FurnitureTextFont/,
);
assert.match(source, /\$request\.captureTextFonts -isnot \[bool\]/);
if (process.platform === "win32") {
	const output = mkdtempSync(path.join(tmpdir(), "opf-style-"));
	const ps = path.join(
		process.env.WINDIR,
		"System32/WindowsPowerShell/v1.0/powershell.exe",
	);
	const env = { ...process.env };
	for (const key of Object.keys(env))
		if (key.toLowerCase() === "psmodulepath") delete env[key];
	const probeReport = path.join(output, "property-probe.json");
	const probe = spawnSync(
		ps,
		[
			"-NoProfile",
			"-NonInteractive",
			"-File",
			fileURLToPath(new URL("native-font-property-probe.ps1", import.meta.url)),
			"-ReportPath",
			probeReport,
			"-ProbeComAdapter",
		],
		{ encoding: "utf8", timeout: 30000, windowsHide: true, env },
	);
	assert.equal(
		probe.status,
		0,
		probe.error?.message ?? probe.stdout + probe.stderr,
	);
	const propertyReport = JSON.parse(
		readFileSync(probeReport, "utf8").replace(/^\uFEFF/, ""),
	);
	assert.equal(propertyReport.explicitMethodControlsPassed, true);
	assert.equal(propertyReport.comAdapter.passed, true);
	assert.equal(propertyReport.comAdapter.released, true);
	assert.equal(propertyReport.officeInvoked, false);
	const result = spawnSync(
		ps,
		[
			"-NoProfile",
			"-NonInteractive",
			"-File",
			fileURLToPath(checker),
			"-ScriptPath",
			fileURLToPath(worker),
			"-ReportPath",
			path.join(output, "report.json"),
		],
		{ encoding: "utf8", timeout: 30000, windowsHide: true, env },
	);
	assert.equal(
		result.status,
		0,
		result.error?.message ?? result.stdout + result.stderr,
	);
	const report = JSON.parse(
		readFileSync(path.join(output, "report.json"), "utf8").replace(
			/^\uFEFF/,
			"",
		),
	);
	assert.equal(report.passed, true);
	assert.equal(report.accepted, 6);
	assert.equal(report.rejected, 23);
	assert.equal(report.textFontControls.length, 15);
	assert.ok(report.textFontControls.every((item) => item.passed));
	console.log(
		"Native style/font descriptor harness controls: Windows AST-only validation and object mocks PASS; no Office.",
	);
} else {
	console.log(
		"Native style harness source policy PASS; Windows PowerShell AST/parser/object mocks NOT RUN on this host.",
	);
}
