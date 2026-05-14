import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    schemas: "src/schemas.ts",
    catalogs: "src/catalogs.ts",
    validator: "src/validator.ts",
    types: "src/types.ts",
    "spec-files": "src/spec-files.ts",
    previews: "src/previews.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  target: "es2022",
  platform: "neutral",
  outExtension() {
    return { js: ".js" };
  },
});
