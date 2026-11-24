import {textInputMap} from './text-input.js';
import {alignLine, traceLines} from './text-pointer.js';

// Line breaks of the plain-text inline input.
//
// The inline input is a native textarea over the canonical SVG glyphs: its text is transparent and the browser supplies
// the caret, the selection and the hit testing of a press on it. That holds only while the browser breaks the textarea's
// lines where the engine broke the drawn ones. The browser wraps greedily at the box width; the engine balances a
// heading's lines (WI-4) and measures with its own faces, so "Scale the pilot to four / teams in January." is drawn with
// "teams in" on the second line while the textarea keeps it on the first. The caret then sits on another line than the
// glyphs: a press on "January" lands past the end of the textarea's second line and the caret stops after "in".
//
// A textarea cannot be told where to break, but its wrap width can be chosen: `inputWrapWidth` finds the width at which
// the browser's own wrapping breaks the text at the drawn breaks (the canvas gives the input that width as side padding,
// so its box and outline stay where they are), measured in a hidden copy of the input.

const MIRRORED = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch', 'fontKerning', 'fontVariantLigatures', 'lineHeight', 'letterSpacing', 'wordSpacing', 'tabSize', 'direction', 'textTransform', 'textIndent', 'overflowWrap', 'wordBreak', 'lineBreak', 'hyphens'];
const HANGING = /[ \t]+$/u;

/**
 * Drawn lines of a traced target as ranges of the input value, in order, blank lines left out: `{start, end}` with the
 * whitespace that hangs at a wrap trimmed from `end`. Several `text` elements on one baseline (the runs of a run-in
 * heading) are one line. Null when the drawing is not a trace of `source` (a formatted number, a draft not drawn yet).
 */
function drawnLines(target, path, source) {
  const map = textInputMap(source), rows = new Map();
  for (const line of traceLines(target, path)) {
    for (const segment of line.segments)
      if (!alignLine(segment.node.textContent, source, segment.start, segment.end)) return null;
    if (line.end > source.length) return null;
    const key = `${line.node.getAttribute('transform') ?? ''}|${line.node.getAttribute('y') ?? ''}`, row = rows.get(key);
    if (row) { row.start = Math.min(row.start, line.start); row.end = Math.max(row.end, line.end); }
    else rows.set(key, {start: line.start, end: line.end});
  }
  const lines = [];
  for (const row of [...rows.values()].sort((a, b) => a.start - b.start)) {
    const start = map.toInput(row.start), text = map.text.slice(start, map.toInput(row.end)).replace(HANGING, '');
    if (text) lines.push({start, end: start + text.length});
  }
  for (let i = 1; i < lines.length; i++) if (lines[i].start < lines[i - 1].end) return null;
  return lines;
}

/**
 * Width in CSS pixels at which the input's own wrapping breaks its value where the canvas drew the line breaks.
 *
 * `{width}` is the wrap width to give the input: the `width` passed in when the browser already agrees with the drawing.
 * `null` means no width reproduces the drawn lines. `undefined` means there is nothing to compare: the drawing is not a
 * trace of the input's value.
 */
export function inputWrapWidth({doc, win, input, target, path, source, width}) {
  const parent = input.parentNode;
  if (!parent || !(width > 0)) return undefined;
  const lines = drawnLines(target, path, source);
  if (!lines?.length) return undefined;
  const style = win.getComputedStyle(input), value = input.value, mirror = doc.createElement('div');
  mirror.setAttribute('aria-hidden', 'true');
  mirror.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;margin:0;padding:0;border:0;box-sizing:border-box;white-space:pre-wrap';
  for (const name of MIRRORED) mirror.style[name] = style[name];
  mirror.textContent = value;
  parent.append(mirror);
  try {
    const node = mirror.firstChild, range = doc.createRange();
    if (!node) return undefined;
    const pitch = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
    const rect = (start, end) => { range.setStart(node, start); range.setEnd(node, end); return range.getBoundingClientRect(); };
    // One whole character at each end of a line: a range over half a surrogate pair has no box of its own.
    const first = (line) => rect(line.start, line.start + String.fromCodePoint(value.codePointAt(line.start)).length);
    const last = (line) => rect(line.end - (line.end - line.start > 1 && /[\uDC00-\uDFFF]/u.test(value[line.end - 1]) ? 2 : 1), line.end);
    // The browser's wrapping at a width agrees when every drawn line stays on one row and each starts a row below the one before.
    const agrees = (candidate) => {
      mirror.style.whiteSpace = 'pre-wrap';
      mirror.style.width = `${candidate}px`;
      let above = -Infinity;
      for (const line of lines) {
        const top = first(line).top;
        if (top < above + pitch / 2 || Math.abs(last(line).top - top) > pitch / 2) return false;
        above = top;
      }
      return true;
    };
    if (agrees(width)) return {width};
    // Unwrapped, each drawn line has its own width: the input must hold the widest one, and must be too narrow for any line
    // to take the first word of the next one (a soft break only; a paragraph break is the input's own).
    mirror.style.whiteSpace = 'pre';
    mirror.style.width = 'auto';
    let widest = 0, next = Infinity;
    for (const [i, line] of lines.entries()) {
      widest = Math.max(widest, rect(line.start, line.end).width);
      const after = lines[i + 1];
      if (!after || value.slice(line.end, after.start).includes('\n')) continue;
      const word = /^\S+/u.exec(value.slice(after.start, after.end))?.[0].length ?? 1;
      next = Math.min(next, rect(line.start, after.start + word).width);
    }
    // Between the two limits, the middle is the width least sensitive to how a browser rounds a line; a box that is too narrow
    // for its widest line grows by as little as holds it.
    const middle = Number.isFinite(next) ? (widest + next) / 2 : widest + 2;
    for (const candidate of [width < widest ? Math.min(middle, widest + 2) : middle, widest + 0.5])
      if (candidate > 0 && agrees(candidate)) return {width: candidate};
    return null;
  } finally {
    mirror.remove();
  }
}
