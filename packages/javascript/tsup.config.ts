import { defineConfig } from "tsup";

const entry = {
  deck: "src/deck.ts",
  markdown: "src/markdown.ts",
  yaml: "src/yaml.ts",
  patch: "src/patch.ts",
  diff: "src/diff.ts",
  format: "src/format.ts",
  convert: "src/convert.ts",
  "font-policy": "src/font-policy.ts",
  "symbol-font-encodings": "src/symbol-font-encodings.ts",
  data: "src/data.ts",
  pagination: "src/pagination.ts",
  composition: "src/composition.ts",
  index: "src/index.ts",
  schemas: "src/schemas.ts",
  catalog: "src/catalog.ts",
  validator: "src/validator.ts",
  types: "src/types.ts",
  "spec-files": "src/spec-files.ts",
  examples: "src/examples.ts",
  docs: "src/docs.ts",
  "repo-readme": "src/repo-readme.ts",
  // RR-70: the root has two builds. `index` (the `node`, `bun` and `deno` conditions) is core plus the file API, whose
  // engine (src/node/) it loads on the first call; `browser` (`browser`, `worker`, `workerd`, `default`) has the same names,
  // with file functions that reject with `node-only`. `node-engine` is the CLI's internal engine (`./internal/engine`, node
  // condition only). No other entry imports them.
  browser: "src/browser.ts",
  "node-engine": "src/node-engine.ts",
};

// One type surface (RR-70): dist/index.d.ts declares both builds of the root, so the browser build ships no declarations.
const { browser: _browser, ...typed } = entry;

export default defineConfig({
  entry,
  format: ["esm"],
  dts: { entry: typed },
  sourcemap: false,
  clean: true,
  splitting: true,
  treeshake: true,
  target: "es2022",
  platform: "neutral",
  // Only the Node build and the CLI engine import node: builtins; scripts/check-browser-safe.mjs proves the others never do.
  external: [/^node:/],
  outExtension() {
    return { js: ".js" };
  },
});
