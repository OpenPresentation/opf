// A face the deck asks for that is drawn with another face (Aptos with Intos) is one `fonts/font-substituted` info finding per requested
// family, with the face drawn instead, how close it is and why when the font policy says; and a font package the deck's faces need that
// is not installed (the renderer's `font-resource-unavailable` naming packages) is read back with its packages, faces and install line.
import assert from "node:assert/strict";
import { test } from "node:test";
import { Reporter, missingFontPackages, missingPeerFrom, reportSubstitutions } from "../dist/node-engine.js";

const row = (requestedFamily, resolvedFamily, compatibility, extra = {}) => ({ requestedFamily, resolvedFamily, compatibility, substitute: true, ...extra });

test("one info finding per substituted family, not per weight, slide or summary", () => {
	const handle = {
		substitutions: [
			row("Aptos", "Intos", "metric", { licenseClass: "proprietary-standard" }),
			row("Aptos", "Intos", "metric", { licenseClass: "proprietary-standard", path: "/slides/1/text" }),
			row("Aptos", "Intos", "visual", { licenseClass: "proprietary-standard" }), // a weight the metric clone lacks
			row("Wingdings Missing", "Noto Sans", "generic"),
			row("Roboto", "Roboto", "exact", { substitute: false }),
		],
	};
	const reporter = new Reporter();
	reportSubstitutions(reporter, handle);
	reportSubstitutions(reporter, handle); // the export builds its font summary more than once
	assert.deepEqual(
		reporter.findings.map((finding) => [finding.ruleId, finding.severity, finding.requested, finding.resolved, finding.compatibility]),
		[
			["fonts/font-substituted", "info", "Aptos", ["Intos"], "visual"],
			["fonts/font-substituted", "info", "Wingdings Missing", ["Noto Sans"], "generic"],
		],
	);
	const [aptos, generic] = reporter.findings;
	assert.equal(aptos.message, "Aptos is drawn with Intos, a visual substitute, so lines can break differently than with the requested font: Aptos is a proprietary font that OPF does not bundle.");
	assert.equal(aptos.licenseClass, "proprietary-standard");
	assert.match(aptos.help, /--fonts/);
	assert.equal(generic.message, "Wingdings Missing is drawn with Noto Sans, the fallback face: no bundled face or declared replacement serves Wingdings Missing.");
});

test("a deck with no substitution gets no finding", () => {
	const reporter = new Reporter();
	reportSubstitutions(reporter, { substitutions: [row("Roboto", "Roboto", "exact", { substitute: false })] });
	assert.deepEqual(reporter.findings, []);
});

test("a renderer error naming font packages is read back with its faces and install line; others are not", () => {
	const fontError = Object.assign(new Error("This presentation needs a font package that is not installed"), {
		code: "font-resource-unavailable",
		details: { packages: ["@expo-google-fonts/cousine"], faces: ["Cousine"], install: "npm install @expo-google-fonts/cousine@0.4.3" },
	});
	const mapped = missingPeerFrom(fontError);
	assert.equal(mapped.code, "peer-not-installed");
	assert.deepEqual(missingFontPackages(mapped), { packages: ["@expo-google-fonts/cousine"], faces: ["Cousine"], install: "npm install @expo-google-fonts/cousine@0.4.3" });
	// A missing renderer, or no error at all, is not a font package.
	const renderer = missingPeerFrom(Object.assign(new Error("no converter"), { code: "converter-missing", details: { package: "sharp" } }));
	assert.equal(missingFontPackages(renderer), undefined);
	assert.equal(missingFontPackages(undefined), undefined);
});
