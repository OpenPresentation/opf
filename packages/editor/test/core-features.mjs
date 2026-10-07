// RR-55: the editor imports every core, renderer and PowerPoint function by name, so a rename or removal fails at load. This test
// fails first, and says which name is missing, when the linked packages do not export what the editor (src, examples, scripts)
// imports. It exists because the editor used to detect core functions at run time (`typeof core.x === "function"`), and a renamed
// export then switched the feature off silently: the Review panel, templates, numbering, chart options, citations and number formats.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const PACKAGE = /^@openpresentation\/(opf|opf-render|opf-pptx)(\/[\w./-]+)?$/;

function* files(directory, extensions) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* files(full, extensions);
    else if (extensions.some((extension) => entry.name.endsWith(extension))) yield full;
  }
}

// ---- 1. every named import from a sibling package is exported by it ----------------------------------------------------------------------
const wanted = new Map(); // module specifier -> Map(name -> first file that imports it)
const namespaceImports = [];
for (const directory of ["src", "examples", "scripts", "test"]) {
  for (const file of files(path.join(root, directory), [".js", ".mjs"])) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
      if (!PACKAGE.test(match[2])) continue;
      const names = match[1].split(",").map((part) => part.trim().replace(/\s+as\s+.+$/, "")).filter(Boolean);
      if (!wanted.has(match[2])) wanted.set(match[2], new Map());
      for (const name of names) if (!wanted.get(match[2]).has(name)) wanted.get(match[2]).set(name, path.relative(root, file));
    }
    for (const match of source.matchAll(/export\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
      if (!PACKAGE.test(match[2])) continue;
      const names = match[1].split(",").map((part) => part.trim().replace(/\s+as\s+.+$/, "")).filter(Boolean);
      if (!wanted.has(match[2])) wanted.set(match[2], new Map());
      for (const name of names) if (!wanted.get(match[2]).has(name)) wanted.get(match[2]).set(name, path.relative(root, file));
    }
    if (directory === "src") for (const match of source.matchAll(/import\s*\*\s*as\s+(\w+)\s+from\s*["']([^"']+)["']/g)) if (PACKAGE.test(match[2])) namespaceImports.push(`${path.relative(root, file)}: ${match[0]}`);
  }
}
assert.ok(wanted.size >= 6, `the scan found the editor's imports (${wanted.size} modules)`);
assert.deepEqual(namespaceImports, [], "src imports sibling packages by name, so a missing export fails at load and never turns a feature off");
let checked = 0;
const missing = [];
for (const [specifier, names] of wanted) {
  const module = await import(specifier);
  for (const [name, file] of names) {
    checked += 1;
    if (!(name in module)) missing.push(`${specifier} has no export ${name} (imported in ${file})`);
  }
}
assert.deepEqual(missing, [], "every core, renderer and PowerPoint name the editor imports exists");

// ---- 2. no run-time feature detection of a sibling export is left in src -----------------------------------------------------------------
const detections = [];
for (const file of files(path.join(root, "src"), [".js"])) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/typeof\s+(?:core|opfCore|opf|renderer|pptx)\.\w+|["']\w+["']\s+in\s+(?:core|opfCore)\b/g)) detections.push(`${path.relative(root, file)}: ${match[0]}`);
}
assert.deepEqual(detections, [], "no `typeof core.x` or `'x' in core` feature detection remains");

// ---- 3. the functions the editor's behaviour stands on are real functions, named here so a removal is caught by name -------------------
const core = await import("@openpresentation/opf");
const composition = await import("@openpresentation/opf/composition");
const render = await import("@openpresentation/opf-render/svg");
const browserFonts = await import("@openpresentation/opf-render/fonts-browser");
const pptx = await import("@openpresentation/opf-pptx");
const required = [
  [core, ["validate", "validateCatalogRecord", "resolveSlideContext", "listBuiltinVariables", "paginate", "stats", "importData", "resolveVariables", "listVariables", "hasContentVariables", "variableDeclarations", "coerceVariableValue", "resolveChartData", "inlineChartData", "inlineTableData", "isXYChartType", "chartNumber", "numberFormatError", "formatDataNumber"]],
  [composition, ["composeSlide", "resolveScriptFonts", "listNumbers", "chartOptionSupport", "chartOptionTarget", "resolveChartOptions", "collectCitations", "walkCitationRuns", "referencesSlide", "captionSettings"]],
  [render, ["renderSvg", "renderSlideSvg", "resolvePresentation"]],
  [browserFonts, ["loadFonts"]],
  [pptx, ["toPptx", "fromPptx", "checkTypefaces", "inventoryTypefaces"]],
];
for (const [module, names] of required) for (const name of names) assert.equal(typeof module[name], "function", `${name} is exported as a function`);
// The old names are gone, not aliased: nothing the editor calls can resolve to a leftover.
for (const name of ["validatePresentation", "auditPresentation", "lintSource", "paginatePresentation", "createDataContent", "excelNumberFormat"]) assert.equal(name in core, false, `core no longer exports ${name}`);
for (const name of ["renderSvgDeck", "loadBrowserFontRegistry"]) assert.equal(name in render || name in browserFonts, false, `the renderer no longer exports ${name}`);
assert.equal("checkPptxTypefaces" in pptx, false, "opf-pptx no longer exports checkPptxTypefaces");

console.log(`Core features: ${checked} named imports from ${wanted.size} sibling modules exist; no run-time feature detection remains.`);
