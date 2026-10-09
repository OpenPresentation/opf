import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
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
    // Node-only (RR-62): the file API and the engine the CLI runs. No other entry imports them.
    node: "src/node.ts",
    "node-engine": "src/node-engine.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: false,
  clean: true,
  splitting: true,
  treeshake: true,
  target: "es2022",
  platform: "neutral",
  // Only the Node-only entries import node: builtins; scripts/check-browser-safe.mjs proves the others never do.
  external: [/^node:/],
  outExtension() {
    return { js: ".js" };
  },
});
