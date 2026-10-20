// RR-97: the in-process conversion of scripts/check-examples-convert.mjs. `convertInProcess(deck, format)` runs what `opf convert
// <deck> out.<format>` runs after it has read its arguments: core's conversion engine (`planConversion` of
// `@openpresentation/opf/internal/engine`, which the CLI calls with the same `assetDir` and the same `flags` argument), and
// applies the CLI's verdict: an engine failure, a file that is not the requested format, or an error-severity finding in the
// report fails the conversion (the CLI's exit 1 with the default `--fail-on error`). Nothing is written: the engine plans every
// file in memory (the drawing, the rasterization and the PPTX package all run), and the CLI's remaining steps only write them.
// Loaded as a worker thread, it answers {id, deck, format} messages with {id, reason}; the engine, the renderer's fonts and the
// PPTX exporter load once per worker and serve every deck it converts.
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isMainThread, parentPort } from 'node:worker_threads';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEDIA = { png: 'image/png', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', svg: 'image/svg+xml' };

let engine;
/** Core's CLI engine, loaded once, from the manifest's `./internal/engine` node entry of the workspace core. */
async function loadEngine() {
  if (!engine) {
    const directory = path.join(root, 'packages', 'javascript');
    const manifest = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));
    engine = await import(pathToFileURL(path.join(directory, manifest.exports['./internal/engine'].node)).href);
  }
  return engine;
}

const describe = (finding) => `${finding.ruleId}${finding.path ? ` ${finding.path}` : ''}: ${finding.message}`;
const errorsOf = (findings) => (findings ?? []).filter((finding) => finding.severity === 'error').map(describe);

/** Why converting `deck` (a path) to `format` fails, or undefined when `opf convert` would exit 0 with no error finding. */
export async function convertInProcess(deck, format) {
  const { planConversion, OPFApiError, deckFileFormat, readDeckReport, checkOptions, defaultCatalogs } = await loadEngine();
  const file = path.resolve(root, deck);
  try {
    // A plain .md is an OPF Markdown outline: `opf convert` reads it as Markdown (a path would be refused by the engine).
    let input = file;
    if (!deckFileFormat(file)) {
      const report = readDeckReport(readFileSync(file, 'utf8'), { format: 'markdown', validate: checkOptions(defaultCatalogs()) }, 'convert');
      if (!report.valid) return [`${deck} is not valid OPF`, ...errorsOf(report.findings)].join('\n    ');
      input = report.presentation;
    }
    const plan = await planConversion(input, path.join(tmpdir(), `opf-examples-convert.${format}`), { assetDir: path.dirname(file) }, true);
    const lines = errorsOf(plan.findings);
    for (const made of plan.files) {
      if (made.type !== MEDIA[format]) lines.push(`${made.path ?? made.name} would be written as ${made.type}, not ${MEDIA[format]}`);
      else if (!made.bytes?.length) lines.push(`${made.path ?? made.name} is empty`);
    }
    if (plan.files.length === 0) lines.push('no file would be written');
    return lines.length > 0 ? lines.join('\n    ') : undefined;
  } catch (error) {
    const found = error instanceof OPFApiError ? errorsOf(error.findings) : [];
    return [`${error?.code ? `${error.code}: ` : ''}${String(error?.message ?? error).split('\n')[0]}`, ...found].join('\n    ');
  }
}

if (!isMainThread && parentPort) {
  parentPort.on('message', async ({ id, deck, format }) => {
    let reason;
    try {
      reason = await convertInProcess(deck, format);
    } catch (error) {
      reason = `internal error: ${error?.stack ?? error}`;
    }
    parentPort.postMessage({ id, reason });
  });
}
