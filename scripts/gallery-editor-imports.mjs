// The editor examples (packages/editor/examples/*.js) import the library by source path (`../src/<module>.js`). The pptx.gallery vendoring
// step (vendor-gallery-editor.mjs) bundles the example against the PUBLISHED editor package, so it rewrites each such import to a package
// specifier first. That specifier must be one the package exports; check:gallery-editor-imports (and the packed-install test of the
// editor) fail when an example imports a module the package does not export.

/** Matches `'../src/<module>.js'` in either quote style (an import, an `import()` or an `export ... from`). */
const SOURCE_IMPORT = /(['"])\.\.\/src\/([^'"/]+)\.js\1/g;

/**
 * Editor modules that the published package ships as dist/<module>.js but does not list in "exports" (opf-editor 0.10.0). The vendoring step
 * bundles them by file path (registry-toolchain.mjs). Do not add to this list: export the module, or import a public entry instead.
 * The check fails when a listed module becomes exported, so the entry is removed with the workaround.
 */
export const UNEXPORTED_EDITOR_MODULES = ['@openpresentation/opf-editor/exact-source', '@openpresentation/opf-editor/font-gate'];

/** The package specifier a source module is rewritten to: the root for `index`, `@openpresentation/opf-editor/<module>` otherwise. */
export const editorSpecifier = (module) => `@openpresentation/opf-editor${module === 'index' ? '' : `/${module}`}`;

/** The `package.json` "exports" key of a specifier: `.` or `./<module>`. */
export const exportsKey = (specifier) => `.${specifier.slice('@openpresentation/opf-editor'.length)}`;

/** The source modules (`index`, `workspace`, ...) a script imports by `../src/<module>.js`, in order of appearance, without duplicates. */
export const sourceImports = (text) => [...new Set([...text.matchAll(SOURCE_IMPORT)].map((match) => match[2]))];

/** The vendoring rewrite: every `../src/<module>.js` becomes its package specifier, the quotes kept. */
export const rewriteEditorExampleImports = (text) => text.replace(SOURCE_IMPORT, (_, quote, module) => `${quote}${editorSpecifier(module)}${quote}`);
