// NT-01: the shared native result format. One vocabulary, two schemas (native-result.schema.json for
// files/<fileId>/result.json, native-run.schema.json for run.json) and the helpers a driver needs to write them.
// README.md beside this file describes the format for a driver's author.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../../..');
const require = createRequire(path.join(root, 'packages/javascript/package.json'));

export const SCHEMA_VERSION = 1;
export const TARGETS = Object.freeze(['keynote', 'powerpoint', 'impress', 'powerpoint-mac']);
export const OBJECT_KINDS = Object.freeze(['title', 'body', 'text', 'list', 'table', 'chart', 'shape', 'connector', 'group', 'picture', 'link', 'notes', 'footer']);
export const OUTCOMES = Object.freeze(['native', 'changed', 'picture', 'dropped', null]);
export const VERB_STATUSES = Object.freeze(['done', 'failed', 'timeout', 'alert', 'not-run']);
/** The verbs a result.json records, in the order a driver runs them. */
export const VERBS = Object.freeze(['open', 'render', 'probe', 'resave']);
/** The functions apps/<target>/driver.mjs exports: check runs once per run (its answer is in run.json), close after each file. */
export const DRIVER_FUNCTIONS = Object.freeze(['check', 'open', 'render', 'probe', 'resave', 'close']);
export const TEXT_LIMIT = 200;

export const resultSchema = JSON.parse(readFileSync(path.join(here, 'native-result.schema.json'), 'utf8'));
export const runSchema = JSON.parse(readFileSync(path.join(here, 'native-run.schema.json'), 'utf8'));

let compiled;
function validators() {
  if (!compiled) {
    const Ajv = require('ajv/dist/2020.js').default;
    const formats = require('ajv-formats').default;
    const ajv = new Ajv({ strict: false, allErrors: true, allowUnionTypes: true });
    formats(ajv);
    compiled = { result: ajv.compile(resultSchema), run: ajv.compile(runSchema) };
  }
  return compiled;
}

// "/verbs: must NOT have additional property 'extra'" rather than ajv's objects. if/then wrappers ("must match \"then\"
// schema") repeat an error already reported at the property, so they are left out.
function readable(errors) {
  const lines = [];
  for (const error of errors ?? []) {
    if (error.keyword === 'if') continue;
    const where = error.instancePath || '/';
    let text = error.message ?? error.keyword;
    if (error.keyword === 'additionalProperties') text = `must NOT have additional property '${error.params.additionalProperty}'`;
    else if (error.keyword === 'enum') text = `must be one of ${error.params.allowedValues.map((value) => JSON.stringify(value)).join(', ')}`;
    else if (error.keyword === 'const') text = `must be ${JSON.stringify(error.params.allowedValue)}`;
    const line = `${where}: ${text}`;
    if (!lines.includes(line)) lines.push(line);
  }
  return lines;
}

/** Checks a result.json value: the schema, then what a schema cannot say. Returns { ok, errors: string[] }. */
export function validateResult(value) {
  const validate = validators().result;
  const errors = validate(value) ? [] : readable(validate.errors);
  if (errors.length === 0) {
    const { file } = value;
    if (file.id !== fileId(file.deck, file.variant)) errors.push(`/file/id: must be "${fileId(file.deck, file.variant)}" (<deck>~<variant>)`);
    value.slides.forEach((slide, position) => {
      if (slide.index !== position + 1) errors.push(`/slides/${position}/index: must be ${position + 1} (slides are listed in file order)`);
    });
    const count = value.verbs.open.slideCount;
    if (count !== undefined && value.slides.length > 0 && value.slides.length !== count) {
      errors.push(`/slides: lists ${value.slides.length} slides, /verbs/open/slideCount says ${count}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Checks a run.json value. Returns { ok, errors: string[] }. */
export function validateRun(value) {
  const validate = validators().run;
  const errors = validate(value) ? [] : readable(validate.errors);
  if (errors.length === 0) {
    const seen = new Set();
    value.files.forEach((file, position) => {
      const id = fileId(file.deck, file.variant);
      if (file.id !== id) errors.push(`/files/${position}/id: must be "${id}" (<deck>~<variant>)`);
      if (file.result !== `files/${file.id}/result.json`) errors.push(`/files/${position}/result: must be "files/${file.id}/result.json"`);
      if (seen.has(file.id)) errors.push(`/files/${position}/id: "${file.id}" is listed twice`);
      seen.add(file.id);
    });
  }
  return { ok: errors.length === 0, errors };
}

const NAME_PART = /^[a-z0-9._-]+$/u;

/** The file id "<deck>~<variant>", lower case; variant "default" when the deck has one export only. */
export function fileId(deck, variant = 'default') {
  const parts = [deck, variant].map((part) => String(part ?? '').toLowerCase());
  for (const part of parts) {
    if (!NAME_PART.test(part)) throw new Error(`fileId: "${part}" must be a-z 0-9 . _ - only (no ~, no spaces)`);
  }
  return parts.join('~');
}

/** Splits a file id back into { deck, variant }. */
export function parseFileId(id) {
  const [deck, variant, extra] = String(id).split('~');
  if (extra !== undefined || variant === undefined) throw new Error(`parseFileId: "${id}" is not <deck>~<variant>`);
  fileId(deck, variant);
  return { deck, variant };
}

/** Plain text cut to the format's limit (200 characters, counted in code points so a surrogate pair is never split). */
export function cutText(text) {
  const chars = Array.from(String(text ?? ''));
  return chars.length <= TEXT_LIMIT ? chars.join('') : chars.slice(0, TEXT_LIMIT).join('');
}

/** The picture path of slide `index` inside a file's folder: slides/slide-001.png. */
export function picturePath(index) {
  return `slides/slide-${String(index).padStart(3, '0')}.png`;
}

/**
 * A result with every verb present and "not-run", no warnings read and no slides. A driver starts from this and fills
 * in what it did, so a verb it skipped can never be missing or claim "done".
 *   emptyResult({ target, application, system, fonts, opf, file: { deck, variant, path, sha256 }, started })
 */
export function emptyResult({ target, application, system, fonts = 'installed', opf, file, started, finished = started }) {
  const variant = file.variant ?? 'default';
  return {
    schemaVersion: SCHEMA_VERSION,
    target,
    application,
    system,
    fonts,
    opf,
    file: {
      id: fileId(file.deck, variant),
      deck: file.deck,
      variant,
      path: file.path,
      sha256: file.sha256,
      unchangedAfterRun: file.unchangedAfterRun ?? null,
    },
    started,
    finished,
    verbs: {
      open: { status: 'not-run', warnings: { status: 'not-read', source: null, lines: [] } },
      render: { status: 'not-run' },
      probe: { status: 'not-run' },
      resave: { status: 'not-run' },
    },
    slides: [],
  };
}

/** The run.json files[] entry of a result. */
export function runFileEntry(result) {
  const { id, deck, variant } = result.file;
  const opened = result.verbs.open.status === 'done' || result.verbs.open.status === 'alert';
  return {
    id,
    deck,
    variant,
    result: `files/${id}/result.json`,
    open: result.verbs.open.status,
    slideCount: opened ? (result.verbs.open.slideCount ?? result.slides.length) : null,
  };
}
