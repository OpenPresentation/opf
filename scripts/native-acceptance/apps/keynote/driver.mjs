// NT-02: the Keynote driver. The contract of core/result/README.md: check, open, probe, render, resave, close, each an
// async function of a context (createContext) the runner keeps for the whole run. Every process goes through ctx.exec
// (machine.mjs execCommand by default; tests pass a fake, so no test runs osascript), every Keynote verb is one
// `osascript keynote.applescript <verb> ...` call with its own timeout.
//
// Rules (the 0.36.0 round's, README.md beside this file): the owner starts Keynote and the driver never starts or quits
// it; check() sends Keynote nothing when it is not running and at most the one read-only `info` event when it is; a
// document is the run's own only by the id in the ledger; nothing is ever saved: Keynote exports into the run directory
// and closes with `saving no`; the input's SHA-256 is compared before and after.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { picturePath } from '../../core/result/result.mjs';
import { foreignDocuments, openLedger } from './ledger.mjs';
import { defaultMachine, execCommand } from './machine.mjs';
import { parseWarnings } from './normalize.mjs';
import { parseProbeLines, unescapeValue } from './probe-lines.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

export const SCRIPT = path.join(here, 'keynote.applescript');
/** Seconds Keynote gets per verb (`with timeout` inside the script); the osascript process gets GRACE more. */
export const TIMEOUTS = Object.freeze({ info: 30, open: 120, probe: 900, render: 600, resave: 600, close: 60 });
export const GRACE = 20;

/**
 * The context of one run: { runDir, exec, machine, timeouts, ledger, warningsText, now, script, facts }. facts is filled
 * by check(): { application, system, documents, wear }.
 *   warningsText(fileId) -> string | null: the text of Keynote's Warnings window for that file, read by someone who could
 *   see it (Keynote shows the window only while it is in front). Without it the warnings are "not-read".
 */
export function createContext({ runDir, exec = execCommand, machine = {}, timeouts = {}, ledger, warningsText, now = () => new Date(), script = SCRIPT }) {
  if (!runDir) throw new Error('createContext: runDir is required');
  return {
    runDir,
    exec,
    machine: { ...defaultMachine, ...machine },
    timeouts: { ...TIMEOUTS, ...timeouts },
    ledger: ledger ?? openLedger(runDir, { now }),
    warningsText,
    now,
    script,
    facts: null,
  };
}

const round = (seconds) => Math.round(seconds * 100) / 100;

// osascript prints "<script path>:<from>:<to>: execution error: <text> (<number>)"; the path is this machine's, so it goes.
export function osascriptMessage(text) {
  return String(text ?? '')
    .trim()
    .replace(/^.*?:\d+:\d+: /u, '');
}

/** One osascript call: the verb's status ("done" / "failed" / "timeout"), seconds, message, stdout. */
async function keynote(ctx, verb, args, seconds) {
  const answer = await ctx.exec('osascript', [ctx.script, verb, ...args], { timeoutMs: (seconds + GRACE) * 1000 });
  const result = { status: 'done', seconds: round(answer.seconds ?? 0), stdout: (answer.stdout ?? '').replace(/\n$/u, '') };
  if (answer.timedOut) {
    result.status = 'timeout';
    result.message = `osascript did not return in ${seconds + GRACE} s and was stopped; Keynote may still be working on the ${verb} event`;
  } else if (answer.code !== 0) {
    const message = osascriptMessage(answer.stderr || answer.stdout) || `osascript exited with ${answer.code}`;
    result.status = /\(-1712\)\s*$/u.test(message) ? 'timeout' : 'failed';
    result.message = message;
  }
  return result;
}

/** The `info` verb's answer -> { version, documents: [{ id, name }] }. */
export function parseInfo(stdout) {
  const info = { version: null, documents: [] };
  for (const line of String(stdout).split('\n')) {
    const [kind, ...fields] = line.split('\t');
    if (kind === 'version') info.version = fields[0]?.trim() || null;
    else if (kind === 'document' && fields[0]) info.documents.push({ id: unescapeValue(fields[0]), name: unescapeValue(fields[1] ?? '') });
  }
  return info;
}

async function info(ctx) {
  const answer = await keynote(ctx, 'info', [], ctx.timeouts.info);
  return answer.status === 'done' ? { ...answer, ...parseInfo(answer.stdout) } : answer;
}

// NT-18: Keynote keeps two descriptors open per imported .pptx on its remote-assets cache
// (~/Library/Containers/com.apple.Keynote/Data/Library/Caches/app-remote-assets/database and database-wal) and does not
// close them while it runs. On 2026-11-27 a Keynote started on 2026-11-25 stopped importing after about 890 documents,
// with 1,784 such descriptors (about 1,830 open in all, measured with lsof): every later open failed with -1728 and left
// an alert in front of the owner. check() refuses when this run's files would take the count past REMOTE_ASSETS_REFUSE
// (about 140 imports short of that failure) and notes a warning past REMOTE_ASSETS_WARN.
export const DESCRIPTORS_PER_IMPORT = 2;
export const REMOTE_ASSETS_REFUSE = 1500;
export const REMOTE_ASSETS_WARN = 1000;

/**
 * Keynote's wear against the files still to run: { refusal: string | null, notes: [string] }. wear is machine.mjs
 * keynoteWear's answer; files the number of files this run still means to open. Unread wear never refuses.
 */
export function judgeWear(wear, files = 0) {
  if (!wear) return { refusal: null, notes: [] };
  if (wear.remoteAssets === null || wear.remoteAssets === undefined) {
    return { refusal: null, notes: [`Keynote's wear: not read (${(wear.problems ?? []).join('; ') || 'no answer'}).`] };
  }
  const planned = Math.max(0, Number(files) || 0);
  const projected = wear.remoteAssets + DESCRIPTORS_PER_IMPORT * planned;
  const since = wear.started ? `since it was started on ${wear.started}` : 'since it was started (start time not read)';
  const notes = [
    `Keynote's wear: process ${wear.pid}, started ${wear.started ?? 'at a time not read'}; ${wear.remoteAssets} open descriptors on app-remote-assets (${wear.descriptors} in all), about ${wear.imports} documents imported; ${planned} file(s) planned, which would bring app-remote-assets to about ${projected} (refused above ${REMOTE_ASSETS_REFUSE}).`,
  ];
  if (projected > REMOTE_ASSETS_REFUSE) {
    return {
      refusal: `Keynote has imported about ${wear.imports} documents ${since}; it stopped importing at about 890 on 2026-11-27; ask the owner to quit and reopen Keynote (the driver never starts or quits it). This run's ${planned} file(s) would bring its app-remote-assets descriptors to about ${projected}, past ${REMOTE_ASSETS_REFUSE}.`,
      notes,
    };
  }
  if (projected > REMOTE_ASSETS_WARN) {
    notes.push(
      `Warning: Keynote has imported about ${wear.imports} documents ${since}; this run would bring its app-remote-assets descriptors to about ${projected} (refused above ${REMOTE_ASSETS_REFUSE}; it stopped importing at about 890 documents on 2026-11-27). Ask the owner to quit and reopen Keynote before a long run.`,
    );
  }
  return { refusal: null, notes };
}

/**
 * Can this Mac run Keynote now? { status: "ready" | "refused", reasons: [], notes: [], facts }. Refuses when Keynote is
 * not running (the owner starts it), when the screen is locked, when a document the run did not open is open, or when
 * Keynote is too worn to import `files` more documents (judgeWear). notes carry Keynote's wear and any warning; they
 * never refuse. Never starts or quits Keynote; sends no Apple event unless Keynote runs and the screen is unlocked, and
 * then only `info`. The wear comes from pgrep, ps and lsof, which send Keynote nothing.
 *   files: how many files the run still means to open (the per-file check passes the number left, this one included).
 */
export async function check(ctx, { files = 0 } = {}) {
  const reasons = [];
  const notes = [];
  const facts = { application: null, system: null, documents: [], wear: null };
  const running = await ctx.machine.keynoteRunning(ctx.exec);
  if (!running) reasons.push('Keynote is not running. The owner starts it; the driver never does.');
  let locked = true;
  try {
    locked = await ctx.machine.screenLocked(ctx.exec);
    if (locked) reasons.push('The screen is locked; Keynote cannot open files while it is. Ask the owner to unlock it.');
  } catch (error) {
    reasons.push(`Could not tell whether the screen is locked: ${error.message}`);
  }
  try {
    facts.system = { os: 'macOS', version: await ctx.machine.macosVersion(ctx.exec) };
  } catch (error) {
    reasons.push(`Could not read the macOS version: ${error.message}`);
  }
  if (running && !locked) {
    const answer = await info(ctx);
    if (answer.status !== 'done' || !answer.version) {
      reasons.push(`Keynote did not answer the info event (${answer.status}${answer.message ? `: ${answer.message}` : ''}).`);
    } else {
      facts.documents = answer.documents;
      const bundle = await ctx.machine.keynoteBundle(ctx.exec).catch(() => null);
      facts.application = { name: 'Keynote', version: answer.version, ...(bundle?.build ? { build: bundle.build } : {}) };
      for (const document of foreignDocuments(answer.documents, ctx.ledger)) {
        reasons.push(`Keynote has a document this run did not open: "${document.name}" (${document.id}). Whoever opened it closes it; the driver never does.`);
      }
    }
  }
  if (running) {
    facts.wear = await Promise.resolve()
      .then(() => ctx.machine.keynoteWear(ctx.exec))
      .catch((error) => ({ pid: null, started: null, descriptors: null, remoteAssets: null, imports: null, problems: [String(error?.message ?? error)] }));
    const judged = judgeWear(facts.wear, files);
    if (judged.refusal) reasons.push(judged.refusal);
    notes.push(...judged.notes);
  }
  ctx.facts = facts;
  return { status: reasons.length === 0 ? 'ready' : 'refused', reasons, notes, facts };
}

export function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/** The folder of one input file inside the run directory: files/<fileId>. */
export function fileDir(ctx, file) {
  return path.join(ctx.runDir, 'files', file.id);
}

function readWarnings(ctx, file) {
  const text = ctx.warningsText?.(file.id);
  return typeof text === 'string' ? parseWarnings([{ ocr: text }]) : { status: 'not-read', source: null, lines: [] };
}

/**
 * Opens one file: file = { id, path } (path absolute). Returns the handle the other verbs take:
 * { file, documentId, sha256Before, slideCount, skipped: [positions], stop, verb } where verb is result.json's verbs.open.
 * stop is true when the run should not go on to another file (an open that timed out, or a document that opened anyway).
 */
export async function open(ctx, file) {
  mkdirSync(fileDir(ctx, file), { recursive: true });
  const sha256Before = sha256File(file.path);
  const answer = await keynote(ctx, 'open', [file.path, String(ctx.timeouts.open)], ctx.timeouts.open);
  const [state, documentId = '', third = '', fourth = ''] = answer.stdout.split('\n')[0].split('\t');
  const handle = { file, documentId: null, sha256Before, slideCount: null, skipped: [], stop: false, verb: { status: answer.status, seconds: answer.seconds } };
  if (answer.message) handle.verb.message = answer.message;
  if (answer.status === 'done' && state === 'OPENED' && documentId !== '') {
    ctx.ledger.add({ documentId, input: file.path, sha256Before, state: 'open' });
    handle.documentId = documentId;
    handle.slideCount = Number(third);
    handle.skipped = fourth
      .split(',')
      .filter(Boolean)
      .map(Number);
    handle.verb.slideCount = handle.slideCount;
  } else {
    if (answer.status === 'done') {
      handle.verb.status = state === 'TIMEOUT' ? 'timeout' : 'failed';
      handle.verb.message = unescapeValue(fourth || third || answer.stdout || 'open returned nothing');
    }
    // A document that opened although open did not finish is the run's: ledger it, so close() takes it and check() lets
    // the run go on; Keynote may still be loading it, so the run stops after this file.
    let late = documentId !== '' ? [{ id: documentId }] : [];
    if (late.length === 0) {
      const now = await info(ctx);
      if (now.status === 'done') late = foreignDocuments(now.documents, ctx.ledger);
    }
    for (const document of late) {
      ctx.ledger.add({ documentId: document.id, input: file.path, sha256Before, state: handle.verb.status === 'timeout' ? 'opened-after-timeout' : 'opened-after-error' });
    }
    if (late.length > 0) {
      handle.documentId = late[0].id;
      handle.verb.message = `${handle.verb.message ?? ''}; the document opened anyway as ${late.map((document) => document.id).join(', ')}`.replace(/^; /u, '');
    }
    handle.stop = handle.verb.status === 'timeout' || late.length > 0;
  }
  handle.verb.warnings = handle.documentId ? readWarnings(ctx, file) : { status: 'not-read', source: null, lines: [] };
  return handle;
}

function requireOpen(handle, verb) {
  if (!handle?.documentId || handle.verb.status !== 'done') throw new Error(`${verb}: the file is not open`);
}

const verbOf = (answer) => {
  const verb = { status: answer.status, seconds: answer.seconds };
  if (answer.message) verb.message = answer.message;
  return verb;
};

/** The object list: { verb, probe } with probe the raw probe object (probe-lines.mjs), also written as probe.json. */
export async function probe(ctx, handle) {
  requireOpen(handle, 'probe');
  const dir = fileDir(ctx, handle.file);
  const lines = path.join(dir, 'probe.lines');
  rmSync(lines, { force: true });
  const answer = await keynote(ctx, 'probe', [handle.documentId, lines, String(ctx.timeouts.probe)], ctx.timeouts.probe);
  const verb = verbOf(answer);
  if (answer.status !== 'done') return { verb, probe: null };
  if (!existsSync(lines)) return { verb: { ...verb, status: 'failed', message: 'the probe wrote no lines' }, probe: null };
  const raw = parseProbeLines(readFileSync(lines, 'utf8'));
  writeFileSync(path.join(dir, 'probe.json'), `${JSON.stringify(raw, null, 1)}\n`);
  rmSync(lines, { force: true });
  if (raw.errors.length > 0) verb.message = `${raw.errors.length} property errors (probe.json errors)`;
  return { verb, probe: raw };
}

/** 1-based positions of the slides Keynote exports a picture of: every slide that is not skipped. */
export function exportedPositions(slideCount, skipped) {
  const hidden = new Set(skipped);
  return Array.from({ length: slideCount }, (_, index) => index + 1).filter((position) => !hidden.has(position));
}

// Keynote names the pictures "<folder name>.001.png", numbered among the exported slides only.
const exportNumber = (name) => Number(/\.(\d+)\.png$/iu.exec(name)?.[1] ?? Number.NaN);

/**
 * Pairs Keynote's exported files with slide positions: [{ from, position, to }] or an error message. The k-th exported
 * file is the k-th slide that is not skipped.
 */
export function pairPictures(files, slideCount, skipped) {
  const pictures = files.filter((name) => /\.png$/iu.test(name)).sort((a, b) => exportNumber(a) - exportNumber(b) || a.localeCompare(b));
  const positions = exportedPositions(slideCount, skipped);
  if (pictures.length !== positions.length) return { error: `Keynote exported ${pictures.length} pictures for ${positions.length} slides that are not skipped` };
  return { pairs: pictures.map((from, k) => ({ from, position: positions[k], to: picturePath(positions[k]) })) };
}

function iccDescription(icc) {
  if (icc.length < 132) return null;
  const count = icc.readUInt32BE(128);
  for (let index = 0; index < count; index += 1) {
    const entry = 132 + index * 12;
    if (entry + 12 > icc.length) break;
    if (icc.toString('latin1', entry, entry + 4) !== 'desc') continue;
    const offset = icc.readUInt32BE(entry + 4);
    const tag = icc.subarray(offset, offset + icc.readUInt32BE(entry + 8));
    const type = tag.toString('latin1', 0, 4);
    if (type === 'desc') return tag.toString('latin1', 12, 12 + tag.readUInt32BE(8)).replace(/\0+$/u, '');
    if (type === 'mluc' && tag.readUInt32BE(8) > 0) {
      const length = tag.readUInt32BE(20);
      const start = tag.readUInt32BE(24);
      return Buffer.from(tag.subarray(start, start + length)).swap16().toString('utf16le');
    }
  }
  return null;
}

/** A PNG's { pixelSize, alpha, colorProfile? } from its header and its embedded ICC profile (iCCP), or null. */
export function pngInfo(buffer) {
  if (buffer.length < 33 || buffer.readUInt32BE(0) !== 0x89504e47 || buffer.toString('latin1', 12, 16) !== 'IHDR') return null;
  const colorType = buffer[25];
  const info = { pixelSize: [buffer.readUInt32BE(16), buffer.readUInt32BE(20)], alpha: colorType === 4 || colorType === 6 };
  for (let offset = 8; offset + 8 <= buffer.length; ) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    if (type === 'IDAT' || type === 'IEND') break;
    if (type === 'iCCP') {
      const data = buffer.subarray(offset + 8, offset + 8 + length);
      try {
        const description = iccDescription(inflateSync(data.subarray(data.indexOf(0) + 2)));
        if (description) info.colorProfile = description;
      } catch {
        // A profile that does not inflate says nothing about the pictures' color.
      }
      break;
    }
    offset += 12 + length;
  }
  return info;
}

/**
 * The pictures: Keynote exports every slide that is not skipped into files/<id>/_export (a folder of its own: the export
 * empties it), then they are renamed slides/slide-00N.png by slide position. { verb, pictures: { position: path } }.
 */
export async function render(ctx, handle) {
  requireOpen(handle, 'render');
  const dir = fileDir(ctx, handle.file);
  const exportDir = path.join(dir, '_export');
  rmSync(exportDir, { recursive: true, force: true });
  mkdirSync(exportDir, { recursive: true });
  const answer = await keynote(ctx, 'render', [handle.documentId, exportDir, String(ctx.timeouts.render)], ctx.timeouts.render);
  const verb = verbOf(answer);
  const pictures = {};
  if (answer.status === 'done') {
    const paired = pairPictures(readdirSync(exportDir), handle.slideCount ?? 0, handle.skipped);
    if (paired.error) {
      verb.status = 'failed';
      verb.message = paired.error;
    } else {
      rmSync(path.join(dir, 'slides'), { recursive: true, force: true });
      mkdirSync(path.join(dir, 'slides'), { recursive: true });
      for (const { from, position, to } of paired.pairs) {
        renameSync(path.join(exportDir, from), path.join(dir, to));
        pictures[position] = to;
      }
      const first = Object.values(pictures)[0];
      const facts = first ? pngInfo(readFileSync(path.join(dir, first))) : null;
      if (facts) Object.assign(verb, facts);
    }
  }
  rmSync(exportDir, { recursive: true, force: true });
  return { verb, pictures };
}

/** Keynote's own PowerPoint copy, files/<id>/resaved.pptx. { verb } with verb.path set when it was written. */
export async function resave(ctx, handle) {
  requireOpen(handle, 'resave');
  const target = path.join(fileDir(ctx, handle.file), 'resaved.pptx');
  rmSync(target, { force: true });
  const answer = await keynote(ctx, 'resave', [handle.documentId, target, String(ctx.timeouts.resave)], ctx.timeouts.resave);
  const verb = verbOf(answer);
  if (answer.status === 'done' && !existsSync(target)) return { verb: { ...verb, status: 'failed', message: 'Keynote wrote no PowerPoint copy' } };
  if (answer.status === 'done') verb.path = 'resaved.pptx';
  return { verb };
}

/** Closes the run's own document with `saving no`. { status, seconds, message?, state: CLOSED | GONE | STILL-OPEN | null }. */
export async function close(ctx, handle) {
  if (!handle?.documentId) return { status: 'not-run', state: null };
  if (!ctx.ledger.has(handle.documentId)) throw new Error(`close: ${handle.documentId} is not a document this run opened`);
  const answer = await keynote(ctx, 'close', [handle.documentId, String(ctx.timeouts.close)], ctx.timeouts.close);
  const state = answer.status === 'done' ? answer.stdout.trim() : null;
  const closed = state === 'CLOSED' || state === 'GONE';
  if (closed) ctx.ledger.mark(handle.documentId, 'closed');
  const verb = verbOf(answer);
  if (answer.status === 'done' && !closed) {
    verb.status = 'failed';
    verb.message = `the document is still open (${state || 'no answer'})`;
  }
  return { ...verb, state };
}
