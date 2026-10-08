import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
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
    catalogs: "src/catalogs.ts",
    catalog: "src/catalog.ts",
    validator: "src/validator.ts",
    types: "src/types.ts",
    "spec-files": "src/spec-files.ts",
    previews: "src/previews.ts",
    examples: "src/examples.ts",
    docs: "src/docs.ts",
    "repo-readme": "src/repo-readme.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: false,
  clean: true,
  splitting: true,
  treeshake: true,
  target: "es2022",
  platform: "neutral",
  outExtension() {
    return { js: ".js" };
  },
});
