// NT-02: one input file end to end through the Keynote driver: open -> probe -> render -> resave -> close, and the
// result.json of the shared format (core/result). close runs whenever the run opened a document, also after a failure or
// an exception, so the run never leaves a document of its own open unless Keynote refuses to close it (then the run
// stops). The general runner (`pnpm native`, NT-05) will call the same functions.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { emptyResult, fileId, runFileEntry, SCHEMA_VERSION, validateResult, validateRun } from '../../core/result/result.mjs';
import * as keynoteDriver from './driver.mjs';
import { slidesFrom } from './normalize.mjs';

export const iso = (date) => date.toISOString().replace(/\.\d{3}Z$/u, 'Z');

const failedVerb = (error) => ({ status: 'failed', message: String(error?.message ?? error) });

/**
 * Runs one file. input = { path (absolute), relativePath (to the run's input root), deck, variant? }.
 * options = { opf: { version, commit? }, fonts?, driver? }. ctx must have been through check() (ctx.facts).
 * Returns { result, validation, close, stop }: stop is true when the run must not go on (open timed out, a document of
 * the run's own could not be closed).
 */
export async function runFile(ctx, input, { opf, fonts = 'installed', driver = keynoteDriver }) {
  if (!ctx.facts?.application || !ctx.facts?.system) throw new Error('runFile: run check(ctx) first; it reads the Keynote and macOS versions');
  const variant = input.variant ?? 'default';
  const file = { id: fileId(input.deck, variant), path: input.path };
  const started = iso(ctx.now());
  const verbs = {};
  let handle = null;
  let probed = null;
  let pictures = {};
  let closed = { status: 'not-run', state: null };
  try {
    try {
      handle = await driver.open(ctx, file);
      verbs.open = handle.verb;
    } catch (error) {
      verbs.open = { ...failedVerb(error), warnings: { status: 'not-read', source: null, lines: [] } };
    }
    if (verbs.open.status === 'done') {
      try {
        const answer = await driver.probe(ctx, handle);
        verbs.probe = answer.verb;
        probed = answer.probe;
      } catch (error) {
        verbs.probe = failedVerb(error);
      }
      try {
        const answer = await driver.render(ctx, handle);
        verbs.render = answer.verb;
        pictures = answer.pictures;
      } catch (error) {
        verbs.render = failedVerb(error);
      }
      try {
        verbs.resave = (await driver.resave(ctx, handle)).verb;
      } catch (error) {
        verbs.resave = failedVerb(error);
      }
    }
  } finally {
    if (handle?.documentId) {
      try {
        closed = await driver.close(ctx, handle);
      } catch (error) {
        closed = { ...failedVerb(error), state: null };
      }
    }
  }

  let unchangedAfterRun = null;
  let sha256 = handle?.sha256Before;
  try {
    sha256 ??= driver.sha256File(input.path);
    unchangedAfterRun = driver.sha256File(input.path) === sha256;
  } catch {
    // The input went away during the run: unchangedAfterRun stays unknown.
  }
  const result = emptyResult({
    target: 'keynote',
    application: ctx.facts.application,
    system: ctx.facts.system,
    fonts,
    opf,
    file: { deck: input.deck, variant, path: input.relativePath, sha256: sha256 ?? '', unchangedAfterRun },
    started,
    finished: iso(ctx.now()),
  });
  for (const [verb, value] of Object.entries(verbs)) result.verbs[verb] = value;
  const slideCount = handle?.slideCount ?? -1;
  const pictured = Object.fromEntries(Object.entries(pictures).map(([position, picture]) => [picture, { slide: Number(position) }]));
  result.slides = slidesFrom({ slideCount, skippedSlides: handle?.skipped ?? [], pictures: pictured }, probed);

  const validation = validateResult(result);
  const dir = path.join(ctx.runDir, 'files', result.file.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
  const leftOpen = Boolean(handle?.documentId) && closed.status !== 'done';
  return { result, validation, close: closed, stop: Boolean(handle?.stop) || leftOpen };
}

/** run.json for the files run so far (core/result/native-run.schema.json). */
export function buildRun(ctx, { opf, fonts = 'installed', started, check, results }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    target: 'keynote',
    application: ctx.facts.application,
    system: ctx.facts.system,
    fonts,
    opf,
    tier: null,
    baseline: null,
    started,
    finished: iso(ctx.now()),
    check: { status: check.status, reasons: check.reasons },
    files: results.map(runFileEntry),
  };
}

export function writeRun(ctx, run) {
  const validation = validateRun(run);
  writeFileSync(path.join(ctx.runDir, 'run.json'), `${JSON.stringify(run, null, 2)}\n`);
  return validation;
}
