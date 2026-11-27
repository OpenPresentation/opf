// NT-02: one input file end to end through the Keynote driver: open -> probe -> render -> resave -> close, and the
// result.json of the shared format (core/result). close runs whenever the run opened a document, also after a failure or
// an exception, so the run never leaves a document of its own open unless Keynote refuses to close it (then the run
// stops). The general runner (`pnpm native`, NT-05) calls the same functions with the driver (and its target) it was given.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { emptyResult, fileId, runFileEntry, SCHEMA_VERSION, validateResult, validateRun } from '../../core/result/result.mjs';
import * as keynoteDriver from './driver.mjs';
import { slidesFrom } from './normalize.mjs';

export const iso = (date) => date.toISOString().replace(/\.\d{3}Z$/u, 'Z');

const failedVerb = (error) => ({ status: 'failed', message: String(error?.message ?? error) });

// NT-18: Keynote's answers that mean it could not write into the run directory (render's export folder, resave's copy):
// "could not be exported ... You don't have permission. (6)" on 2026-11-27, and the classic write errors -54 (permErr),
// -61 (wrPermErr), -5000 (afpAccessDenied).
const WRITE_ERROR = /permission|not permitted|could(?: not|n[’']t) be (?:exported|saved|written)|\((?:-54|-61|-5000)\)\s*$/iu;

/** True when a verb's answer is a permission or write error of the application (not our own "wrote no copy" check). */
export function isWriteError(verb) {
  return verb?.status === 'failed' && WRITE_ERROR.test(String(verb.message ?? ''));
}

/**
 * Runs one file. input = { path (absolute), relativePath (to the run's input root), deck, variant? }.
 * options = { opf: { version, commit? }, fonts?, driver?, target?, keepGoing? } (driver and target default to Keynote's).
 * ctx must have been through check() (ctx.facts).
 * Returns { result, validation, close, stop, stopReason }: stop is true when the run must send the application no further
 * file, and stopReason says why. It stops when open did not return a document (failed, alert or timeout: a refused
 * import may leave an alert in front of the owner, and every further open on 2026-11-27 left another), when render or
 * resave failed with a permission or write error after open and probe were done (then resave is not sent, the document is
 * closed and the run stops), when a document opened although open did not finish, and when a document of the run's own
 * could not be closed. keepGoing (run.mjs --keep-going; the native runner never sets it) goes on after a refused import
 * or a write error, as before NT-18; a timed-out open and a document left open still stop.
 */
export async function runFile(ctx, input, { opf, fonts = 'installed', driver = keynoteDriver, target = 'keynote', keepGoing = false }) {
  if (!ctx.facts?.application || !ctx.facts?.system) throw new Error('runFile: run check(ctx) first; it reads the application and system versions');
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
      // A write error on render (2026-11-27: "You don't have permission. (6)") is not sent a resave that would fail the same way.
      if (keepGoing || !(verbs.probe.status === 'done' && isWriteError(verbs.render))) {
        try {
          verbs.resave = (await driver.resave(ctx, handle)).verb;
        } catch (error) {
          verbs.resave = failedVerb(error);
        }
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
    target,
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
  const name = ctx.facts.application?.name ?? 'the application';
  let stopReason = null;
  if (leftOpen) stopReason = `its document did not close (${closed.message ?? closed.state}); close it by hand`;
  else if (verbs.open.status === 'timeout' || handle?.stop) stopReason = `open did not finish; look at ${name} before the next run`;
  else if (verbs.open.status !== 'done' && !keepGoing) {
    stopReason = `${name} refused to import ${result.file.id}: ${verbs.open.message ?? verbs.open.status}. An alert may be showing in ${name}; only the owner dismisses it. No further file was sent.`;
  } else if (verbs.open.status === 'done' && verbs.probe?.status === 'done' && !keepGoing) {
    const written = ['render', 'resave'].find((verb) => isWriteError(verbs[verb]));
    if (written) stopReason = `${name} could not write the ${written} of ${result.file.id}: ${verbs[written].message}. The document was ${closed.status === 'done' ? 'closed' : 'not closed'}; no further file was sent. ${name} may be worn out: ask the owner to look at it.`;
  }
  return { result, validation, close: closed, stop: stopReason !== null, stopReason };
}

/** run.json for the files run so far (core/result/native-run.schema.json); tier and baseline are the runner's (NT-05). check is check()'s answer. */
export function buildRun(ctx, { opf, fonts = 'installed', started, check, results, target = 'keynote', tier = null, baseline = null }) {
  return {
    schemaVersion: SCHEMA_VERSION,
    target,
    application: ctx.facts.application,
    system: ctx.facts.system,
    fonts,
    opf,
    tier,
    baseline,
    started,
    finished: iso(ctx.now()),
    // run.json's check is strict ({ status, reasons }); check()'s notes (Keynote's wear, a warning) follow its reasons there.
    check: { status: check.status, reasons: [...check.reasons, ...(check.notes ?? [])] },
    files: results.map(runFileEntry),
  };
}

export function writeRun(ctx, run) {
  const validation = validateRun(run);
  writeFileSync(path.join(ctx.runDir, 'run.json'), `${JSON.stringify(run, null, 2)}\n`);
  return validation;
}
