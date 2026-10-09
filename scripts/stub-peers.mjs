// RR-74: stand-in opf-render and opf-pptx packages for a test of the engine's calls. Core and the CLI load both from their own
// location (packages/javascript/src/node/peers.ts), so a copy of core in a tree of its own (scripts/isolated-core.mjs) with these two
// beside it runs against them whatever renderer is installed in the workspace. The stubs draw nothing: every call appends one JSON line
// `{ call, args }` to `log.jsonl` in the working directory (the catalogs, which are large, are left out), so a test reads what the
// engine asked of the renderer: `toSvg(deck, slide, options)` with slides counted from 1, `toPng(svg, options)`, `toPdf(svgs, options)`,
// `loadFonts(options)` and, for opf-pptx, `toPptx(deck, options)`. They provide the 0.18 API of opf-render and the 0.17 API of opf-pptx.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const STUB_LOG = 'log.jsonl';

const LOG = [
  'import { appendFileSync } from "node:fs";',
  `const log = (call, ...args) => appendFileSync(${JSON.stringify(STUB_LOG)}, JSON.stringify({ call, args }, (key, value) => (key === "catalogs" ? undefined : value)) + "\\n");`,
];

const RENDER = [
  ...LOG,
  'export const toSvg = (deck, slide, options) => (log("toSvg", slide, options), `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"></svg>`);',
  'export const toPng = async (svg, options) => (log("toPng", options), new Uint8Array(40));',
  'export const toPdf = async (svgs, options) => (log("toPdf", svgs.length, options), new TextEncoder().encode("%PDF-stub"));',
];

const FONTS = [
  ...LOG,
  'export const loadFonts = async (options) => {',
  '  log("loadFonts", options);',
  '  return { stub: true, textMeasurement: {}, embeddedFonts: [{ family: "Stub", weight: 400, dataUrl: "data:font/ttf;base64,AA==" }], fontFiles: [], useBundledFonts: false, loadSystemFonts: false, registry: {}, substitutions: [] };',
  '};',
];

const PPTX = [
  ...LOG,
  'export const toPptx = async (deck, options) => (log("toPptx", options), new Uint8Array([0x50, 0x4b]));',
  'export const fromPptx = async () => ({});',
  'export const inventoryTypefaces = () => [];',
];

/** Write the stubs into `modules` (a node_modules directory) as `@openpresentation/opf-render` (with `/fonts-node`) and `@openpresentation/opf-pptx`, version 0.18.0. */
export async function installStubPeers(modules) {
  const packages = { 'opf-render': { 'index.js': RENDER, 'fonts-node.js': FONTS }, 'opf-pptx': { 'index.js': PPTX } };
  for (const [name, files] of Object.entries(packages)) {
    const directory = path.join(modules, '@openpresentation', name);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: `@openpresentation/${name}`, version: '0.18.0', type: 'module', main: 'index.js' }));
    for (const [file, lines] of Object.entries(files)) await writeFile(path.join(directory, file), `${lines.join('\n')}\n`);
  }
}

/** The calls a run logged, parsed: `[{ call, args }]`. */
export function parseStubLog(text) {
  return text.split('\n').filter(Boolean).map((line) => JSON.parse(line));
}
