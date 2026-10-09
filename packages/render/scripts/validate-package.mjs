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
assert.equal(typeof api.toSvg, "function");
assert.equal(typeof api.resolvePresentation, "function");
assert.equal(typeof api.toPng, "function");
assert.equal(typeof api.toPdf, "function");
const browserExport = await import(new URL("../dist/export-browser.js", import.meta.url));
assert.equal(typeof browserExport.toPdf, "function");
assert.equal(typeof browserExport.toPng, "function");
assert.equal(api.runtimePolicy.requiredNetworkCalls, false);
assert.equal(api.runtimePolicy.deterministicLocalExecution, true);

// RR-28: the player and the <opf-deck> element are public entry points; importing them on a server defines nothing.
for (const key of ["./player", "./element", "./element/define", "./preview-fonts", "./preview-fonts-node"]) assert.ok(pkg.exports[key], `Missing export ${key}`);
assert.deepEqual(pkg.sideEffects, ["./dist/element-define.js"], "Only the tag registration file may have side effects");
const element = await import(new URL("../dist/element.js", import.meta.url));
assert.equal(typeof element.defineOpfDeck, "function");
assert.equal(typeof element.toHtml, "function");
assert.equal(element.defineOpfDeck(), undefined);
assert.equal(typeof (await import(new URL("../dist/player.js", import.meta.url))).present, "function");

// RR-63: the converters and the font packages are optional peers, never runtime dependencies: an SVG-only install holds none of them.
for (const name of ["pdf-lib", "@resvg/resvg-js", "sharp"]) {
  assert.equal(pkg.dependencies[name], undefined, `${name} must not be a runtime dependency`);
  assert.ok(pkg.peerDependencies[name], `${name} must be a peer dependency`);
  assert.equal(pkg.peerDependenciesMeta[name]?.optional, true, `${name} must be an optional peer`);
}
for (const name of Object.keys(pkg.dependencies)) assert.ok(!name.startsWith("@expo-google-fonts/"), `${name} must be an optional peer, not a runtime dependency`);
// RR-63: the format entries (`/svg`, `/png`, `/pdf`) resolve; /png and /pdf are the Node converters.
for (const key of ["./svg", "./png", "./pdf"]) assert.ok(pkg.exports[key], `Missing export ${key}`);
assert.equal(typeof (await import(new URL("../dist/png.js", import.meta.url))).toPng, "function");
assert.equal(typeof (await import(new URL("../dist/pdf.js", import.meta.url))).toPdf, "function");

for (const forbidden of forbiddenDependencyNames) {
  assert.ok(!deps[forbidden], `Forbidden critical-path dependency: ${forbidden}`);
}

console.log(`${pkg.name} metadata is release-lane ready.`);
