const T = 'packages/javascript/tsup.config.ts';
const P = 'packages/javascript/package.json';
const G = 'packages/javascript/scripts/generate.mjs';
const C = 'scripts/check-catalog-free.mjs';
export default [
  [T, `  "diagram-engine-lazy": "src/diagram-engine-lazy.ts",
};`, `  "diagram-engine-lazy": "src/diagram-engine-lazy.ts",
  // SH-02: the two shape engines \`#shape-engine\` chooses between by export condition: SH-01's preset geometry loaded with core (Node and
  // Bun and Deno), or loaded the first time a deck has a shape (browsers and edge runtimes, ensureShapes).
  "shape-engine-eager": "src/shape-engine-eager.ts",
  "shape-engine-lazy": "src/shape-engine-lazy.ts",
};`],
  [T, `"diagram-engine-eager": _eager, "diagram-engine-lazy": _lazy, ...typed } = entry;`, `"diagram-engine-eager": _eager, "diagram-engine-lazy": _lazy, "shape-engine-eager": _shapeEager, "shape-engine-lazy": _shapeLazy, ...typed } = entry;`],
  [T, `  external: [/^node:/, /^#schema-engine$/, /^#diagram-engine$/],`, `  external: [/^node:/, /^#schema-engine$/, /^#diagram-engine$/, /^#shape-engine$/],`],
  [P, `      "browser": "./dist/diagram-engine-lazy.js",
      "default": "./dist/diagram-engine-eager.js"
    }`, `      "browser": "./dist/diagram-engine-lazy.js",
      "default": "./dist/diagram-engine-eager.js"
    },
    "#shape-engine": {
      "types": "./src/shape-engine-eager.ts",
      "workerd": "./dist/shape-engine-lazy.js",
      "worker": "./dist/shape-engine-lazy.js",
      "edge-light": "./dist/shape-engine-lazy.js",
      "browser": "./dist/shape-engine-lazy.js",
      "default": "./dist/shape-engine-eager.js"
    }`],
  [G, `  await fs.writeFile(path.join(generatedRoot, "preset-geometry.ts"), lines.join("\\n"));
}`, `  await fs.writeFile(path.join(generatedRoot, "preset-geometry.ts"), lines.join("\\n"));
  // SH-02: the preset names alone, which composition and validation read without loading the geometry (#shape-engine).
  const names = [generatedHeader("spec/reference/preset-geometry.json"), \`export const PRESET_NAMES: readonly string[] = Object.freeze(\${JSON.stringify(Object.keys(table.shapes))});\`, ""];
  await fs.writeFile(path.join(generatedRoot, "preset-names.ts"), names.join("\\n"));
}`],
  [C, `/** The tsup entries of the core package, as { name: source }. */`, `/**
 * SH-02: an esbuild plugin that resolves \`#shape-engine\` as a browser bundler does: to the lazy engine, whose dynamic import of SH-01's
 * preset geometry stays external, a chunk a page loads only when a deck has a shape (src/shape-engine-lazy.ts).
 */
export const shapeEnginePlugin = () => ({
  name: 'shape-engine',
  setup(build) {
    build.onResolve({ filter: /^#shape-engine$/ }, () => ({ path: path.join(packageRoot, 'src', 'shape-engine-lazy.ts') }));
    build.onResolve({ filter: /^\\.\\/shape-geometry\\.js$/ }, (args) => args.kind === 'dynamic-import' && /shape-engine-lazy\\.ts$/.test(args.importer) ? { path: args.path, external: true } : undefined);
  },
});

/** The tsup entries of the core package, as { name: source }. */`],
  [C, `      plugins: [schemaEnginePlugin(), diagramEnginePlugin()],`, `      plugins: [schemaEnginePlugin(), diagramEnginePlugin(), shapeEnginePlugin()],`],
];
