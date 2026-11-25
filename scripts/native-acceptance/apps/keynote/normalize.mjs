// NT-01: turns what the 0.36.0 Keynote round's tools recorded for one file (kn-run's run.json and knprobe's probe.json)
// into a result.json of the shared format (core/result/native-result.schema.json). Pure functions: nothing here talks to
// Keynote or reads a file. The NT-02 driver writes the shared format directly and keeps using the mapping below.
//
// What the recorded files cannot say, and who fills it in:
// - outcome: a probe alone cannot tell native from changed; every object gets null and the round-trip step (NT-04)
//   compares the exported file with Keynote's own PowerPoint copy.
// - lists and links: Keynote's dictionary has no bullets, numbering or links, so no object becomes "list" or "link"
//   here; the round-trip step reads them from the copy (NT-04).
// - footers: no placeholder types either; a live slide-number field reads as U+FFFC inside an ordinary text item.
// - object names: Keynote does not expose them, except a picture's, which its description ends with.
// - the application build and the system version: not recorded; the caller passes them (options.application, options.system).
import { cutText, emptyResult, picturePath } from '../../core/result/result.mjs';

const WARNINGS_PLACEHOLDER = 'To view warnings, click or open a presentation.';
const NO_WARNINGS = "There aren't any warnings for this presentation.";
// The panel's own lines around the list: its title, two sentences of preamble and the Replace Fonts button.
const PANEL_BOILERPLATE = [/^Warnings\b/u, /^This PowerPoint presentation/u, /^Here[’']s a list/u, /^Replace Fonts/u];

const sameApostrophes = (text) => text.replaceAll('’', "'");

/** "Slide(s) 4", "Slide(s): 2, 5-7" -> [4] / [2, 5, 6, 7]. */
function slideNumbers(text) {
  const numbers = [];
  for (const [, from, to] of text.matchAll(/(\d+)(?:\s*[-–]\s*(\d+))?/gu)) {
    const start = Number(from);
    const end = to === undefined ? start : Number(to);
    for (let number = start; number <= end; number += 1) numbers.push(number);
  }
  return numbers;
}

/**
 * The import warnings from kn-run's warningsPanel: text recognized in captures of Keynote's Warnings window. The panel is
 * on screen only while Keynote is in front, so an empty list means "not read", not "none". The panel's own lines are
 * dropped; a "Slide(s) …" or "Slide Layout(s): …" line belongs to the warning above it.
 */
export function parseWarnings(panels = []) {
  if (panels.length === 0) return { status: 'not-read', source: null, lines: [] };
  // One window id is captured once; with several captures the last one that shows a list wins.
  const readable = panels.filter((panel) => !sameApostrophes(panel.ocr ?? '').includes(WARNINGS_PLACEHOLDER) && (panel.ocr ?? '').trim() !== '');
  if (readable.length === 0) return { status: 'not-read', source: 'screen', lines: [] };
  const raw = readable
    .at(-1)
    .ocr.split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const lines = [];
  let cut = false;
  for (const text of raw) {
    if (PANEL_BOILERPLATE.some((pattern) => pattern.test(text))) continue;
    if (sameApostrophes(text) === NO_WARNINGS) continue;
    const layouts = /^Slide Layout\(s\):?\s*(.*)$/u.exec(text);
    const slides = layouts ? null : /^Slide\(s\):?\s*(.*)$/u.exec(text);
    const previous = lines.at(-1);
    if (layouts && previous) {
      previous.layouts = [...(previous.layouts ?? []), ...layouts[1].split(',').map((name) => name.trim()).filter(Boolean)];
    } else if (slides && previous) {
      previous.slides = [...(previous.slides ?? []), ...slideNumbers(slides[1])];
    } else {
      lines.push({ text });
    }
    // A long list runs past the panel's bottom edge; the recognized text then ends in an ellipsis.
    cut = /(…|\.\.\.)$/u.test(text);
  }
  return { status: cut ? 'partial' : 'read', source: 'screen', lines };
}

// kn-run joins its errors with "; "; each starts with a fixed phrase that names the step.
function verbOfError(part) {
  if (/^probe\b/u.test(part)) return 'probe';
  if (/^(slide export failed|exported \d+ pictures)/u.test(part)) return 'render';
  if (/^(export as PowerPoint failed|close:)/u.test(part)) return 'resave';
  return 'open';
}

/** Verb statuses, seconds and messages from run.json's status, phases and message. */
export function verbsFromRun(run) {
  const phases = run.phases ?? {};
  const opened = typeof run.documentId === 'string' && run.documentId !== '';
  const verbs = {
    open: { status: opened ? 'done' : 'failed' },
    render: { status: 'slides' in phases ? 'done' : 'not-run' },
    probe: { status: 'probe' in phases ? 'done' : 'not-run' },
    resave: { status: 'pptxBack' in phases ? 'done' : 'not-run' },
  };
  const seconds = { open: phases.open, render: phases.slides, probe: phases.probe, resave: phases.pptxBack };
  for (const [verb, value] of Object.entries(seconds)) if (typeof value === 'number') verbs[verb].seconds = value;
  if (opened && run.slideCount >= 0) verbs.open.slideCount = run.slideCount;
  if (verbs.resave.status === 'done') verbs.resave.path = 'resaved.pptx';

  const message = run.message ?? '';
  const addMessage = (verb, text) => {
    verbs[verb].message = verbs[verb].message ? `${verbs[verb].message}; ${text}` : text;
  };
  if (run.status === 'TIMEOUT') {
    verbs.open.status = 'timeout';
    if (message) addMessage('open', message);
  } else if (run.status === 'ALERT') {
    // After open, the alert belongs to the last verb that ran; before, to open itself.
    const last = !opened || message.startsWith('an unexpected Keynote window appeared after open') ? 'open' : (['resave', 'render', 'probe'].find((verb) => verbs[verb].status === 'done') ?? 'open');
    verbs[last].status = 'alert';
    if (message) addMessage(last, message);
  } else if (message) {
    for (const part of message.split('; ').filter(Boolean)) {
      const verb = opened ? verbOfError(part) : 'open';
      addMessage(verb, part);
      // "probe: 3 property errors" is a finished probe with gaps; every other error is a failure.
      if (!/^probe: \d+ property errors/u.test(part)) verbs[verb].status = 'failed';
    }
  }
  return verbs;
}

function fontsOf(item) {
  const names = [...(item.wordFonts ?? []), ...(item.paragraphs ?? []).filter((paragraph) => paragraph.text).map((paragraph) => paragraph.font)];
  return [...new Set(names.filter((name) => typeof name === 'string' && name !== ''))];
}

const boxOf = (item) => (Array.isArray(item.position) ? [item.position[0], item.position[1], item.width, item.height] : undefined);

const KIND_OF_CLASS = { image: 'picture', line: 'connector', group: 'group', table: 'table', chart: 'chart' };

/** One probe item as a shared object. Keynote classes the slide title as "shape" or "text item"; isDefaultTitle tells. */
export function objectFromItem(item) {
  const appClass = item.class;
  let kind = KIND_OF_CLASS[appClass];
  if (appClass === 'text item' || appClass === 'shape') {
    if (item.isDefaultTitle) kind = 'title';
    else if (item.isDefaultBody) kind = 'body';
    else if (appClass === 'text item' || (item.text ?? '') !== '') kind = 'text';
    else kind = 'shape';
  }
  // A class the 0.36.0 round never saw (movie, audio clip): keep Keynote's word in appClass.
  kind ??= 'shape';
  const object = { kind, outcome: null, appClass };
  // Keynote's description of a picture is its title, a blank line and its name ("Harbor\n\nOPF image 1").
  if (appClass === 'image' && typeof item.description === 'string' && item.description !== '') object.name = item.description.split('\n\n').at(-1);
  const box = boxOf(item);
  if (box) object.box = box;
  if (typeof item.text === 'string' && item.text !== '') object.text = cutText(item.text);
  const fonts = appClass === 'table' ? [...new Set((item.cells?.['font name'] ?? []).filter(Boolean))] : fontsOf(item);
  if (fonts.length > 0) object.fonts = fonts;
  if (appClass === 'table') {
    object.rows = item['row count'];
    object.columns = item['column count'];
  }
  if (appClass === 'group') object.objects = (item.items ?? []).map(objectFromItem);
  return object;
}

/** Slides by position: Keynote reports slide number -1 for a skipped slide, so the index is the slide's place in the list. */
export function slidesFrom(run, probe) {
  const probed = probe?.slides ?? [];
  const count = Math.max(run.slideCount ?? -1, probed.length);
  const pictured = new Set(Object.values(run.pictures ?? {}).map((picture) => picture.slide));
  if (probed.length === 0 && pictured.size === 0) return [];
  const skipped = new Set(run.skippedSlides ?? []);
  const slides = [];
  for (let index = 1; index <= count; index += 1) {
    const source = probed[index - 1];
    const notes = typeof source?.['presenter notes'] === 'string' && source['presenter notes'] !== '' ? source['presenter notes'] : null;
    const objects = (source?.items ?? []).map(objectFromItem);
    if (notes !== null) objects.push({ kind: 'notes', outcome: null, text: cutText(notes) });
    slides.push({
      index,
      hidden: source ? source.skipped === true : skipped.has(index),
      layout: source?.layout ?? null,
      picture: pictured.has(index) ? picturePath(index) : null,
      notes,
      objects,
    });
  }
  return slides;
}

function relativeInput(input, inputRoot) {
  let relative = String(input).replaceAll('\\', '/');
  if (inputRoot) {
    const prefix = `${String(inputRoot).replaceAll('\\', '/').replace(/\/+$/u, '')}/`;
    if (relative.startsWith(prefix)) relative = relative.slice(prefix.length);
  }
  if (relative.startsWith('/') || /^[A-Za-z]:/u.test(relative)) throw new Error(`normalize: input "${input}" is not under the input root; pass options.inputRoot`);
  return relative;
}

/**
 * Raw recorded files -> result.json.
 *   normalize({ run, probe }, { opf: { version, commit? }, system: { os, version }, fonts?, inputRoot?, deck?, variant?, application? })
 * deck and variant default to kn-run's name split at "~" (variant "default" when there is none). The application version
 * comes from probe.json (Keynote's own answer), never from run.json's "keynote", which kn-run hard-coded.
 */
export function normalize({ run, probe }, options) {
  const [nameDeck, nameVariant] = String(run.name).split('~');
  const deck = (options.deck ?? nameDeck).toLowerCase();
  const variant = (options.variant ?? nameVariant ?? 'default').toLowerCase();
  const version = options.application?.version ?? probe?.app?.version;
  if (!version) throw new Error(`normalize: ${run.name} has no probe.json app.version; pass options.application`);
  const result = emptyResult({
    target: 'keynote',
    application: { name: 'Keynote', ...options.application, version },
    system: options.system,
    fonts: options.fonts ?? 'installed',
    opf: options.opf,
    file: {
      deck,
      variant,
      path: relativeInput(run.input, options.inputRoot),
      sha256: run.sha256Before,
      unchangedAfterRun: typeof run.shaUnchanged === 'boolean' ? run.shaUnchanged : null,
    },
    started: run.started,
    finished: run.finished,
  });
  const verbs = verbsFromRun(run);
  result.verbs = {
    open: { ...verbs.open, warnings: parseWarnings(run.warningsPanel) },
    render: verbs.render,
    probe: verbs.probe,
    resave: verbs.resave,
  };
  result.slides = slidesFrom(run, verbs.probe.status === 'not-run' ? null : probe);
  return result;
}
