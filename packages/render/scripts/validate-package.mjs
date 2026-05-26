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
assert.equal(api.runtimePolicy.requiredNetworkCalls, false);
assert.equal(api.runtimePolicy.deterministicLocalExecution, true);

for (const forbidden of forbiddenDependencyNames) {
  assert.ok(!deps[forbidden], `Forbidden critical-path dependency: ${forbidden}`);
}

console.log(`${pkg.name} metadata is release-lane ready.`);
