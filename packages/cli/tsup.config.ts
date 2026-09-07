import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";
const manifest = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const core = JSON.parse(readFileSync(new URL("../javascript/package.json", import.meta.url), "utf8"));

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: false,
  noExternal: [/.*/],
  define: { CLI_VERSION: JSON.stringify(manifest.version), OPF_VERSION: JSON.stringify(core.version) },
  sourcemap: true,
  clean: true,
  target: "node20",
  platform: "node",
  banner: { js: "#!/usr/bin/env node" },
});
