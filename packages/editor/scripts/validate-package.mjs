import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
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
assert.ok(pkg.peerDependencies?.["@openpresentation/opf-render"], "Must declare renderer trace compatibility as a peer.");
assert.ok(pkg.exports?.["./react"], "Must expose optional React bindings as a separate entry point.");
assert.ok(pkg.exports?.["./svelte"], "Must expose optional Svelte bindings as a separate entry point.");

assert.ok(pkg.exports?.["./switches"], "Must expose the FF-16 dimension switches as a separate entry point.");
assert.equal(pkg.exports["./switches"].default, "./dist/switches.js");
assert.equal(pkg.exports["./switches"].types, "./dist/switches.d.ts");
for (const [entry, file] of [["./block-convert", "block-convert"], ["./design-options", "design-options"], ["./tables", "table-options"], ["./design-controls", "design-controls"], ["./slides", "slides"], ["./outline", "outline"], ["./slide-manager", "slide-manager"], ["./outline-view", "outline-view"], ["./persistence", "persistence"], ["./persistence-ui", "persistence-ui"], ["./assets", "assets"], ["./backgrounds", "background-options"], ["./data-grid", "data-grid"], ["./chart-data", "chart-data"], ["./grid-text", "grid-text"], ["./content-actions", "content-actions"]]) {
  assert.ok(pkg.exports?.[entry], `Must expose ${entry} as a separate entry point (RR-06).`);
  assert.equal(pkg.exports[entry].default, `./dist/${file}.js`);
  assert.equal(pkg.exports[entry].types, `./dist/${file}.d.ts`);
}

for (const [entry, file] of [["./templates", "templates"], ["./template-panel", "template-panel"]]) {
  assert.ok(pkg.exports?.[entry], `Must expose ${entry} as a separate entry point (RR-32).`);
  assert.equal(pkg.exports[entry].default, `./dist/${file}.js`);
  assert.equal(pkg.exports[entry].types, `./dist/${file}.d.ts`);
}

assert.ok(pkg.exports?.["./export"], "Must expose the RR-23 PDF, PNG and SVG export as a separate entry point.");
assert.equal(pkg.exports["./export"].default, "./dist/export.js");
assert.equal(pkg.exports["./export"].types, "./dist/export.d.ts");
for (const [entry, file] of [["./review", "review"], ["./review-panel", "review-panel"]]) {
  assert.ok(pkg.exports?.[entry], `Must expose ${entry} as a separate entry point (RR-29).`);
  assert.equal(pkg.exports[entry].default, `./dist/${file}.js`);
  assert.equal(pkg.exports[entry].types, `./dist/${file}.d.ts`);
}

for (const [entry, file] of [["./chart-options", "chart-options"], ["./chart-options-panel", "chart-options-panel"]]) {
  assert.ok(pkg.exports?.[entry], `Must expose ${entry} as a separate entry point (RR-35).`);
  assert.equal(pkg.exports[entry].default, `./dist/${file}.js`);
  assert.equal(pkg.exports[entry].types, `./dist/${file}.d.ts`);
}

for (const [entry, file] of [["./numbering", "numbering"], ["./numbering-panel", "numbering-panel"]]) {
  assert.ok(pkg.exports?.[entry], `Must expose ${entry} as a separate entry point (RR-33).`);
  assert.equal(pkg.exports[entry].default, `./dist/${file}.js`);
  assert.equal(pkg.exports[entry].types, `./dist/${file}.d.ts`);
}

for (const forbidden of forbiddenDependencyNames) {
  assert.ok(!deps[forbidden], `Forbidden critical-path dependency: ${forbidden}`);
}

console.log(`${pkg.name} metadata is release-lane ready.`);
