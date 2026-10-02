import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const api = await import(new URL("../dist/index.js", import.meta.url));
const deps = {
  ...pkg.dependencies,
  ...pkg.optionalDependencies,
  ...pkg.peerDependencies
};

const forbiddenDependencyNames = [
  "@anthropic-ai/sdk",
  "@fal-ai/client",
  "@google/generative-ai",
  "@openai/sdk",
  "@pptx/sdk",
  "@vercel/analytics",
  "openai",
  "posthog-js",
  "pptx-dev"
];

assert.equal(pkg.license, "MIT");
assert.equal(pkg.private, false);
assert.equal(pkg.publishConfig?.access, "public");
assert.ok(pkg.name.startsWith("@openpresentation/"));
assert.ok(pkg.repository?.url?.includes("github.com/OpenPresentation/"));
assert.ok(deps["@openpresentation/opf"], "Must declare compatibility with @openpresentation/opf");
assert.equal(typeof api.renderSvg, "function");
assert.equal(typeof api.renderSvgDeck, "function");
assert.equal(typeof api.resolvePresentation, "function");
assert.equal(typeof api.svgToPng, "function");
assert.equal(typeof api.svgToPdf, "function");
const browserExport = await import(new URL("../dist/export-browser.js", import.meta.url));
assert.equal(typeof browserExport.svgToPdf, "function");
assert.equal(typeof browserExport.svgToPng, "function");
assert.equal(api.runtimePolicy.requiredNetworkCalls, false);
assert.equal(api.runtimePolicy.deterministicLocalExecution, true);

// RR-28: the player and the <opf-deck> element are public entry points; importing them on a server defines nothing.
for (const key of ["./player", "./element", "./element/define", "./preview-fonts", "./preview-fonts-node"]) assert.ok(pkg.exports[key], `Missing export ${key}`);
assert.deepEqual(pkg.sideEffects, ["./dist/element-define.js"], "Only the tag registration file may have side effects");
const element = await import(new URL("../dist/element.js", import.meta.url));
assert.equal(typeof element.defineOpfDeck, "function");
assert.equal(typeof element.renderDeckHtml, "function");
assert.equal(element.defineOpfDeck(), undefined);
assert.equal(typeof (await import(new URL("../dist/player.js", import.meta.url))).present, "function");

for (const forbidden of forbiddenDependencyNames) {
  assert.ok(!deps[forbidden], `Forbidden critical-path dependency: ${forbidden}`);
}

console.log(`${pkg.name} metadata is release-lane ready.`);
