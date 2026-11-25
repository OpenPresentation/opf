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
// so its box and outline stay where they are). Candidate widths come from a hidden copy of the text; every width that is
// returned has been checked on a hidden textarea of its own, the same element type as the input, so what a host page's CSS
// does to a textarea (font features, `text-wrap`, ...) is in the answer and not guessed.

const MIRRORED = [
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch', 'fontKerning', 'fontVariant', 'fontVariantLigatures', 'fontVariantNumeric',
  'fontVariantCaps', 'fontVariantEastAsian', 'fontVariantPosition', 'fontFeatureSettings', 'fontVariationSettings', 'fontOpticalSizing',
  'fontSynthesis', 'fontLanguageOverride', 'textRendering', 'lineHeight', 'letterSpacing', 'wordSpacing', 'tabSize', 'direction', 'unicodeBidi',
  'textTransform', 'textIndent', 'textWrap', 'textWrapMode', 'textWrapStyle', 'overflowWrap', 'wordBreak', 'lineBreak', 'hyphens',
  'hyphenateCharacter', 'whiteSpaceCollapse', 'textSpacingTrim', 'textAutospace', 'hangingPunctuation', 'textAlign', 'writingMode',
];
// Spaces that hang at a soft wrap and take no room: the ASCII ones, the Unicode spaces that break, and the ideographic space.
const HANGING = /[ \t  -  -  　]+$/u;

/**
 * Drawn lines of a traced target as ranges of the input value, in order, blank lines left out: `{start, end}` with the
 * whitespace that hangs at a wrap trimmed from `end`. Several `text` elements on one baseline (the runs of a run-in
 * heading) are one line. Null when the drawing is not a trace of `source` (a formatted number, a draft not drawn yet).
 */
function drawnLines(target, path, source) {
  const map = textInputMap(source), rows = new Map();
  for (const line of traceLines(target, path)) {
    // A line drawn right to left, or the last segment of a line, may leave out the space that hangs at its wrap.
    for (const segment of line.segments) {
      const text = segment.node.textContent, hung = segment.start + source.slice(segment.start, segment.end).replace(HANGING, '').length;
      if (!alignLine(text, source, segment.start, segment.end) && !alignLine(text, source, segment.start, hung)) return null;
    }
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
 * trace of the input's value, or the input sits under a transform or zoom that makes client and CSS pixels differ.
 */
export function inputWrapWidth({doc, win, input, target, path, source, width}) {
  const parent = input.parentNode;
  if (!parent || !(width > 0)) return undefined;
  const lines = drawnLines(target, path, source);
  if (!lines?.length) return undefined;
  const style = win.getComputedStyle(input), value = input.value;
  const pitch = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
  const copy = (element) => {
    element.setAttribute('aria-hidden', 'true');
    element.setAttribute('tabindex', '-1');
    if (input.lang) element.lang = input.lang;
    if (input.dir) element.dir = input.dir;
    Object.assign(element.style, {position: 'absolute', left: '0', top: '0', visibility: 'hidden', pointerEvents: 'none', margin: '0', padding: '0', border: '0', outline: '0', boxSizing: 'border-box', resize: 'none', overflow: 'hidden'});
    for (const name of MIRRORED) if (style[name]) element.style[name] = style[name];
  };
  // The probe is a textarea like the input (its class carries the host's rules for it), holding the same text.
  const probe = doc.createElement('textarea'), mirror = doc.createElement('div');
  probe.className = input.className;
  probe.readOnly = true;
  probe.rows = 1;
  copy(probe);
  copy(mirror);
  probe.style.height = '1px';
  probe.style.whiteSpace = style.whiteSpace;
  mirror.style.whiteSpace = 'pre';
  mirror.textContent = value;
  parent.append(probe, mirror);
  try {
    // A transform or zoom above the input: client pixels are not CSS pixels, and a width found in one is wrong in the other.
    mirror.style.width = '100px';
    const unit = mirror.getBoundingClientRect().width / 100;
    if (!(unit > 0) || Math.abs(unit - 1) > 0.005) return undefined;
    const node = mirror.firstChild, range = doc.createRange();
    if (!node) return undefined;
    const rect = (start, end) => { range.setStart(node, start); range.setEnd(node, end); return range.getBoundingClientRect(); };
    // How much of the next drawn line must not fit on this one: its first word, or only its first character where this line breaks
    // inside a word (a word longer than the box), which the browser may break one character later.
    const reach = (line, after) => value.slice(line.end, after.start)
      ? /^\S+/u.exec(value.slice(after.start, after.end))?.[0].length ?? 1
      : String.fromCodePoint(value.codePointAt(after.start)).length;
    // Rows the browser gives a prefix of the value at a width.
    const rows = (end, candidate) => {
      probe.style.width = `${candidate}px`;
      probe.value = value.slice(0, end);
      return Math.round(probe.scrollHeight / pitch);
    };
    // Paragraph breaks and whitespace-only paragraphs are rows of their own that no drawn line stands for.
    const expected = lines.map((line, i) => {
      const before = value.slice(0, line.end).split('\n');
      return i + 1 + before.filter((paragraph) => !paragraph.replace(HANGING, '')).length;
    });
    // The browser's wrapping at a width agrees when every prefix ending at a drawn line end has the rows the drawing has, and the
    // first word of the next line of a paragraph (a soft break) does not fit on the line before it.
    const agrees = (candidate) => {
      for (const [i, line] of lines.entries()) {
        if (rows(line.end, candidate) !== expected[i]) return false;
        const after = lines[i + 1];
        if (!after || value.slice(line.end, after.start).includes('\n')) continue;
        const word = reach(line, after);
        if (rows(after.start + word, candidate) !== expected[i] + 1) return false;
      }
      return true;
    };
    if (agrees(width)) return {width};
    // Unwrapped, each drawn line has its own width: the input must hold the widest one, and must be too narrow for any line
    // to take the first word of the next one (a soft break only; a paragraph break is the input's own).
    mirror.style.width = 'auto';
    let widest = 0, next = Infinity;
    for (const [i, line] of lines.entries()) {
      widest = Math.max(widest, rect(line.start, line.end).width);
      const after = lines[i + 1];
      if (!after || value.slice(line.end, after.start).includes('\n')) continue;
      const word = reach(line, after);
      next = Math.min(next, rect(line.start, after.start + word).width);
    }
    // Between the two limits, the middle is the width least sensitive to how a browser rounds a line; a box that is too narrow
    // for its widest line grows by as little as holds it.
    const middle = Number.isFinite(next) ? (widest + next) / 2 : widest + 2;
    for (const candidate of [width < widest ? Math.min(middle, widest + 2) : middle, widest + 0.5])
      if (candidate > 0 && agrees(candidate)) return {width: candidate};
    return null;
  } finally {
    probe.remove();
    mirror.remove();
  }
}
