import { defineConfig } from "tsup";

const entry = {
  deck: "src/deck.ts",
  markdown: "src/markdown.ts",
  yaml: "src/yaml.ts",
  schema: "src/schema-navigation.ts",
  source: "src/source.ts",
  patch: "src/patch.ts",
  ids: "src/ids.ts",
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
  // CE-01: the two schema engines `#schema-engine` (package.json "imports") chooses between by export condition. The shared
  // modules import the specifier and tsup leaves it as written, so the host's bundler or runtime picks the engine.
  "schema-engine-ajv": "src/schema-engine-ajv.ts",
  "schema-engine-precompiled": "src/schema-engine-precompiled.ts",
  // CE-01: `import "@openpresentation/opf/precompiled"` installs the precompiled engine where the conditions did not choose it.
  precompiled: "src/precompiled.ts",
};

// One type surface (RR-70): dist/index.d.ts declares both builds of the root, so the browser build ships no declarations.
const { browser: _browser, "schema-engine-ajv": _ajv, "schema-engine-precompiled": _precompiled, ...typed } = entry;

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
  external: [/^node:/, /^#schema-engine$/],
  // CE-01: the precompiled validators are CommonJS that require two helpers of ajv and ajv-formats. Bundle them, so the
  // edge build has no `require` and no dependency left to resolve.
  noExternal: [/^ajv\/dist\/runtime\//, /^ajv-formats\/dist\/formats$/],
  outExtension() {
    return { js: ".js" };
  },
});
