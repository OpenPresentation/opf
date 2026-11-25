// NT-02: turns the probe lines keynote.applescript writes (path<TAB>type<TAB>value) into the raw probe object that
// normalize.mjs reads (the same keys as the 0.36.0 round's probe.json). Pure functions: nothing here talks to Keynote.
//
// Types: s text, e an enumeration or other dictionary value (already its name), n number, b boolean, null, list (the value
// is the count; the members follow as <path>/#i), err (the property failed: the value becomes null and one entry goes into
// errors). A path is "/"-separated; "#i" is a list position.
//
// Derived, not read from Keynote (listed in `derived`): skippedSlides (1-based positions of skipped slides; Keynote reports
// slide number -1 for a skipped slide, so the round's tool, which used the slide number, recorded [-1]), per item
// isDefaultTitle / isDefaultBody (the item has the default title or body item's position, size and text: how a probe
// tells that a title sits in the layout's title placeholder) and per table cellsByRow (the cell values cut into rows).

const UNESCAPE = /\\(u2028|u2029|[\\tnr])/gu;
const ESCAPES = { '\\': '\\', t: '\t', n: '\n', r: '\r', u2028: ' ', u2029: ' ' };

export const DERIVED = Object.freeze(['skippedSlides', 'isDefaultTitle', 'isDefaultBody', 'cellsByRow']);

export function unescapeValue(text) {
  return text.replace(UNESCAPE, (_, code) => ESCAPES[code]);
}

// AppleScript writes numbers as text in the user's number format: "51.840000152588", "1.0E+4", and in some regions "0,5".
function number(text) {
  const plain = /^-?\d+,\d+$/u.test(text) ? text.replace(',', '.') : text;
  const value = Number(plain);
  return Number.isFinite(value) && plain.trim() !== '' ? value : text;
}

function isContainer(value) {
  return value !== null && typeof value === 'object';
}

function setPath(root, keys, value) {
  let current = root;
  keys.forEach((part, position) => {
    const key = part.startsWith('#') ? Number(part.slice(1)) : part;
    const last = position === keys.length - 1;
    if (Array.isArray(current)) while (current.length <= key) current.push(null);
    const existing = current[key];
    if (last) {
      // A null or an empty list never replaces what members already filled in (an err line on "document" before its fields).
      if (isContainer(existing) && (value === null || (Array.isArray(value) && value.length === 0))) return;
      current[key] = value;
      return;
    }
    if (!isContainer(existing)) current[key] = keys[position + 1].startsWith('#') ? [] : {};
    current = current[key];
  });
}

function sameBox(item, placeholder) {
  return (
    JSON.stringify(item.position) === JSON.stringify(placeholder.position) &&
    item.width === placeholder.width &&
    item.height === placeholder.height &&
    (item.text ?? '') === (placeholder['object text'] ?? '')
  );
}

function* walk(items) {
  for (const item of items ?? []) {
    if (!isContainer(item) || Array.isArray(item)) continue;
    yield item;
    yield* walk(item.items);
  }
}

/** Adds the derived keys to a parsed probe, in place. */
export function derive(probe) {
  const slides = Array.isArray(probe.slides) ? probe.slides : [];
  probe.skippedSlides = slides.flatMap((slide, position) => (isContainer(slide) && slide.skipped === true ? [position + 1] : []));
  for (const slide of slides) {
    if (!isContainer(slide)) continue;
    const transition = slide.transition;
    if (Array.isArray(transition) && transition.length === 4) {
      const [effect, duration, delay, automatic] = transition;
      slide.transition = { effect, duration, delay, automatic };
    }
    const title = isContainer(slide['default title item']) ? slide['default title item'] : {};
    const body = isContainer(slide['default body item']) ? slide['default body item'] : {};
    for (const item of walk(slide.items)) {
      if (slide['title showing'] && title.width) item.isDefaultTitle = sameBox(item, title);
      if (slide['body showing'] && body.width) item.isDefaultBody = sameBox(item, body);
      if (item.class === 'table' && isContainer(item.cells)) {
        const columns = item['column count'] || 0;
        const nonEmpty = (list) => (Array.isArray(list) && list.length > 0 ? list : null);
        const values = nonEmpty(item.cells['formatted value']) ?? nonEmpty(item.cells.value) ?? [];
        const rows = [];
        if (columns) for (let start = 0; start < values.length; start += columns) rows.push(values.slice(start, start + columns));
        item.cellsByRow = rows;
      }
    }
  }
  probe.derived = [...DERIVED];
  return probe;
}

/** Probe lines (one string, or an array of lines) -> the raw probe object: app, document, slides, errors and the derived keys. */
export function parseProbeLines(text) {
  const lines = Array.isArray(text) ? text : String(text).split('\n');
  const root = {};
  const errors = [];
  for (const raw of lines) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
    if (line === '') continue;
    const first = line.indexOf('\t');
    const second = first < 0 ? -1 : line.indexOf('\t', first + 1);
    const path = first < 0 ? line : line.slice(0, first);
    const type = first < 0 ? '' : second < 0 ? line.slice(first + 1) : line.slice(first + 1, second);
    const value = unescapeValue(second < 0 ? '' : line.slice(second + 1));
    let parsed;
    if (type === 'n') parsed = number(value);
    else if (type === 'b') parsed = value === 'true';
    else if (type === 'null') parsed = null;
    else if (type === 'list') parsed = [];
    else if (type === 'err') {
      parsed = null;
      errors.push({ path, error: value });
    } else parsed = value;
    setPath(root, path.split('/'), parsed);
  }
  root.errors = errors;
  return derive(root);
}
