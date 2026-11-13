// Source policy plus the maintained AST-only mock checker on Windows. No Office object is constructed.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { constants, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
assert.doesNotMatch(source, /\.SaveAs\(|\.Save\(/, "Read-only inputs are never saved in place");
assert.match(source, /\.Open\(\$Path,-1,0,0\)/, 'Owned source/reopen must be read-only and windowless');
assert.doesNotMatch(source, /\.Open\(\$Path,-1,0,-1\)/, 'Visible owned opens are forbidden');
assert.match(source, /\.SaveCopyAs\(\$CopyPath,24\)/);
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
	const evidence = { scope: "Office-free style/probe control diagnostics; no native acceptance", fixtureOutput: output, node: process.version, platform: process.platform, children: [], files: {}, primaryFailure: null, captureErrors: [] };
	let artifact = null, hasPrimaryFailure = false;
	const captureError = error => { evidence.captureErrors.push({name: String(error?.name ?? "Error"), message: String(error?.message ?? error)}); };
	try {
		const parent = fileURLToPath(new URL("../artifacts/native-furniture-style-controls/", import.meta.url));
		mkdirSync(parent, {recursive: true}); assert.ok(lstatSync(parent).isDirectory() && !lstatSync(parent).isSymbolicLink(), "Owned regular style artifact parent required"); artifact = mkdtempSync(path.join(parent, "run-"));
	} catch (error) { captureError(error); }
	const captureKnownOutputs = () => {
		if (!artifact) throw new Error("Owned style artifact directory unavailable");
		for (const file of ["property-probe.json", "property-probe.json.phases.jsonl", "report.json", "report.json.plans/serialized-curved-refusal.json"]) {
			const from = path.join(output, file);
			if (!existsSync(from)) { evidence.files[file] = {present: false}; continue; }
			const stat = lstatSync(from);
			if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 * 1024) throw new Error("Known style fixture output is linked, nonregular or oversized");
			const to = path.join(artifact, file); mkdirSync(path.dirname(to), {recursive: true});
			if (existsSync(to)) assert.deepEqual(readFileSync(to), readFileSync(from), "Previously retained fixture output remains exact");
			else copyFileSync(from, to, constants.COPYFILE_EXCL);
			evidence.files[file] = {present: true, bytes: stat.size};
		}
	};
	const retain = (name, child, elapsedMilliseconds) => {
		try {
			evidence.children.push({name, elapsedMilliseconds, status: child.status, signal: child.signal, error: child.error ? {name: child.error.name, message: child.error.message, code: child.error.code ?? null} : null});
			if (!artifact) throw new Error("Owned style artifact directory unavailable");
			for (const stream of ["stdout", "stderr"]) {
				const value = child[stream] ?? "";
				if (Buffer.byteLength(value) > 1024 * 1024) throw new Error("Style child output exceeds retained bound");
				writeFileSync(path.join(artifact, name + "." + stream + ".log"), value, {flag: "wx"});
			}
			captureKnownOutputs();
			writeFileSync(path.join(artifact, "receipt.json"), JSON.stringify(evidence, null, 2) + "\n");
		} catch (error) { captureError(error); }
	};
	try {
		const ps = path.join(
			process.env.WINDIR,
			"System32/WindowsPowerShell/v1.0/powershell.exe",
		);
		const env = { ...process.env };
		for (const key of Object.keys(env))
			if (key.toLowerCase() === "psmodulepath") delete env[key];
		const probeReport = path.join(output, "property-probe.json");
		const probeStarted = performance.now();
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
		retain("property-probe", probe, performance.now() - probeStarted);
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
		const harnessStarted = performance.now();
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
		retain("harness", result, performance.now() - harnessStarted);
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
		assert.equal(report.accepted, 12);
		assert.equal(report.rejected, 81);
		assert.equal(report.cases.filter(item => item.name.startsWith("point-") && item.expected === "reject").length, 49);
		assert.equal(report.chartPointControls.length, 45);
		assert.equal(report.chartPointControls.filter(item => /^(pie-translated|pie-full-circle|doughnut-radial)-/.test(item.name ?? "")).length, 9);
		assert.equal(report.chartPointControls.filter(item => /^(pie-midradius|pie-center-nonfinite|pie-outer-nonfinite|doughnut-inner-nonfinite)/.test(item.name ?? "")).length, 6);
		assert.deepEqual(report.chartPointControls.slice(-4).map(item => item.name), ["wrong-native-kind", "mixed-series-type", "unsupported-native-type", "doughnut-api-unavailable"]);
		assert.ok(report.chartPointControls.every(item => item.passed));
		const failedNative = report.chartPointControls.find(item => item.name === "serialized-curved-refusal");
		assert.equal(failedNative.rawObservations, 12);
		const serialized = JSON.parse(readFileSync(failedNative.path, "utf8").replace(/^\uFEFF/, ""));
		assert.equal(serialized.actionPlan.chartPoints.length, 0);
		assert.equal(serialized.actionPlan.currentChartPointProbe.sliceCoordinates.length, 12);
		assert.equal(report.lifecycleControls.length, 14);
		assert.ok(report.lifecycleControls.every(item => item.passed));
		assert.deepEqual(report.lifecycleControls.map(item => item.name), ["readonly-copy-edit-reopen", "wrong-open-path", "writable-open", "copy-failure", "copy-identity-change", "refuse-input-overwrite", "refuse-existing-output", "refuse-unowned-close", "close-failure", "refuse-nonempty-application-adoption", "refuse-nonempty-application-quit", "quit-failure", "refuse-unowned-application-quit", "refuse-running-office"]);
		assert.equal(report.textFontControls.length, 15);
		assert.ok(report.textFontControls.every((item) => item.passed));
		console.log(
			"Native style/font descriptor harness controls: Windows AST-only validation and object mocks PASS; no Office.",
		);
	} catch (error) { hasPrimaryFailure = true; evidence.primaryFailure = {name: String(error?.name ?? "Error"), message: String(error?.message ?? error)}; throw error; }
	finally {
		try { captureKnownOutputs(); } catch (error) { captureError(error); }
		try { if (artifact) writeFileSync(path.join(artifact, "receipt.json"), JSON.stringify(evidence, null, 2) + "\n"); } catch (error) { captureError(error); }
		if (evidence.captureErrors.length) {
			if (hasPrimaryFailure) console.error("Style diagnostic preservation also failed:", evidence.captureErrors);
			else throw new Error("Style diagnostic preservation failed: " + JSON.stringify(evidence.captureErrors));
		}
	}
} else {
	console.log(
		"Native style harness source policy PASS; Windows PowerShell AST/parser/object mocks NOT RUN on this host.",
	);
}
