import {textInputMap} from './text-input.js';

// Pointer -> caret mapping for the plain-text inline input.
//
// The user clicks the canonical SVG glyphs; the native textarea supplies the caret. Offsets are resolved from the SVG
// text geometry (each rendered line carries its exact source range in `data-opf-source-start/end` or
// `data-opf-text-start/end`) and converted to textarea offsets with `textInputMap`, so CRLF sources, tabs, collapsed
// whitespace at wraps and bidi isolate marks all resolve to the input value's offsets, never to a glyph index. A line
// whose text does not match its traced source range falls back to a hidden mirror of the positioned textarea.
const SEGMENTER = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, {granularity: 'grapheme'}) : null;
const STRONG_RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/u;
const STRONG_LTR = /[\p{L}\p{N}]/u;
const ISOLATE = /[\u2066-\u2069]/u;
const graphemes = (text) => SEGMENTER ? [...SEGMENTER.segment(text)].map((part) => ({index: part.index, text: part.segment})) : [...text].map((char, i, all) => ({index: all.slice(0, i).join('').length, text: char}));

const numeric = (node, ...names) => {
  for (const name of names) {
    const value = node.getAttribute(name);
    if (value !== null && value !== '' && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
};

const rangeOf = (node) => {
  const start = numeric(node, 'data-opf-source-start', 'data-opf-text-start'), end = numeric(node, 'data-opf-source-end', 'data-opf-text-end');
  return start === null || end === null || end < start ? null : {node, start, end};
};

/**
 * Rendered text lines of a target with their source ranges, in document order. A line is a traced `text` element; its
 * segments are the traced `tspan`s inside it (tabs, script or direction runs) or the element itself.
 */
function traceLines(target, path) {
  const lines = [];
  for (const node of target.querySelectorAll('text')) {
    const own = node.getAttribute('data-opf-path');
    if (own !== null && own !== path) continue;
    const line = rangeOf(node);
    if (!line) continue;
    const nested = [...node.querySelectorAll('tspan')].map(rangeOf).filter(Boolean);
    lines.push({node, start: line.start, end: line.end, segments: nested.length ? nested : [line]});
  }
  return lines;
}

/** Source offset of every UTF-16 index of a rendered line, or null when the line is not its traced source slice. */
function alignLine(text, source, start, end) {
  const slice = source.slice(start, end), positions = [];
  let at = 0;
  for (let i = 0; i < text.length; i++) {
    if (slice[at] === text[i]) { positions.push(start + at); at++; }
    else if (ISOLATE.test(text[i])) positions.push(start + at);
    else return null;
  }
  return at === slice.length ? positions : null;
}

function isRtl(win, node, segment) {
  if (STRONG_RTL.test(segment)) return true;
  if (STRONG_LTR.test(segment)) return false;
  return win.getComputedStyle(node).direction === 'rtl';
}

/** Caret boundaries of one traced line: `{offset, x}` in client pixels, offsets in source coordinates. */
function lineBoundaries(doc, win, line, source) {
  const result = [], range = doc.createRange();
  for (const segment of line.segments) {
    const {node} = segment, text = node.textContent, positions = alignLine(text, source, segment.start, segment.end);
    if (!positions) return null;
    if (!text) {
      const matrix = node.getScreenCTM?.();
      if (!matrix) return null;
      result.push({offset: segment.start, x: new win.DOMPoint(Number(node.getAttribute('x')) || 0, 0).matrixTransform(matrix).x});
      continue;
    }
    const child = node.firstChild;
    if (child?.nodeType !== 3) return null;
    for (const part of graphemes(text)) {
      // Directional isolate marks are zero-width and not source characters; their rects are not caret positions.
      if (ISOLATE.test(part.text)) continue;
      range.setStart(child, part.index);
      range.setEnd(child, part.index + part.text.length);
      const box = range.getBoundingClientRect(), rtl = isRtl(win, node, part.text), after = part.index + part.text.length;
      result.push({offset: positions[part.index], x: rtl ? box.right : box.left});
      result.push({offset: after < positions.length ? positions[after] : segment.end, x: rtl ? box.left : box.right});
    }
  }
  return result.length ? result : null;
}

/** Vertical centre of a rendered line in client pixels. */
function lineCentre(win, line) {
  const box = line.node.getBoundingClientRect();
  if (box.height > 0 || box.width > 0) return box.top + box.height / 2;
  const matrix = line.node.getScreenCTM?.(), size = Number(line.node.getAttribute('font-size')) || 16;
  if (!matrix) return Infinity;
  const point = new win.DOMPoint(0, (Number(line.node.getAttribute('y')) || 0) - size * 0.3).matrixTransform(matrix);
  return point.y;
}

function nearestOffset(points, clientX) {
  let best = null, distance = Infinity;
  for (const point of points) {
    const gap = Math.abs(point.x - clientX);
    if (gap < distance) { best = point; distance = gap; }
  }
  return best?.offset ?? null;
}

function traceOffset({doc, win, target, path, source, clientX, clientY}) {
  const lines = traceLines(target, path);
  if (!lines.length) return null;
  let line = null, gap = Infinity;
  for (const candidate of lines) {
    const distance = Math.abs(lineCentre(win, candidate) - clientY);
    if (distance < gap) { line = candidate; gap = distance; }
  }
  if (!line) return null;
  const points = lineBoundaries(doc, win, line, source);
  return points ? nearestOffset(points, clientX) : null;
}

/** Nearest caret offset in a hidden copy of the positioned textarea (line breaks, wrapping and alignment included). */
function mirrorOffset({doc, win, input, clientX, clientY}) {
  const parent = input.parentNode, host = parent?.getBoundingClientRect?.();
  if (!parent || !host) return null;
  const box = input.getBoundingClientRect(), style = win.getComputedStyle(input), mirror = doc.createElement('div');
  mirror.setAttribute('aria-hidden', 'true');
  mirror.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;margin:0;padding:0;border:0;overflow:hidden;box-sizing:border-box;white-space:pre-wrap;overflow-wrap:break-word;left:${box.left - host.left}px;top:${box.top - host.top}px;width:${box.width}px`;
  for (const name of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch', 'fontKerning', 'fontVariantLigatures', 'lineHeight', 'letterSpacing', 'wordSpacing', 'textAlign', 'tabSize', 'direction', 'textTransform', 'textIndent'])
    mirror.style[name] = style[name];
  const value = input.value;
  mirror.textContent = value;
  parent.append(mirror);
  try {
    const child = mirror.firstChild;
    if (!child) return 0;
    const range = doc.createRange(), flat = [], align = style.textAlign;
    const lineStart = align === 'right' || align === 'end' ? box.right : align === 'center' ? (box.left + box.right) / 2 : box.left;
    const pitch = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
    for (const part of graphemes(value)) {
      range.setStart(child, part.index);
      range.setEnd(child, part.index + part.text.length);
      const rect = range.getBoundingClientRect(), rtl = isRtl(win, mirror, part.text), newline = part.text === '\n' || part.text === '\r\n';
      if (!rect.height && !rect.width) continue;
      const cy = rect.top + rect.height / 2;
      flat.push({offset: part.index, x: rtl ? rect.right : rect.left, cy});
      if (!newline) flat.push({offset: part.index + part.text.length, x: rtl ? rect.left : rect.right, cy});
    }
    if (value.endsWith('\n')) {
      const last = flat.findLast((point) => point.offset === value.length - 1);
      flat.push({offset: value.length, x: lineStart, cy: (last?.cy ?? box.top) + pitch});
    }
    let cy = null, gap = Infinity;
    for (const point of flat) {
      const distance = Math.abs(point.cy - clientY);
      if (distance < gap - 0.5) { cy = point.cy; gap = distance; }
    }
    const row = flat.filter((point) => Math.abs(point.cy - cy) <= pitch / 2);
    return nearestOffset(row, clientX);
  } finally {
    mirror.remove();
  }
}

/**
 * Textarea offset (LF-normalized, the coordinates `selectionStart` uses) nearest to a client point.
 * `source` is the canonical string the SVG was rendered from; `target` is the traced canvas target of `path`.
 */
export function textInputOffsetAtPoint({doc, win, target, path, source, input, clientX, clientY}) {
  const map = textInputMap(source);
  const clamp = (offset) => Math.max(0, Math.min(input.value.length, offset));
  let sourceOffset = null;
  try {
    if (target) sourceOffset = traceOffset({doc, win, target, path, source, clientX, clientY});
  } catch { sourceOffset = null; }
  if (sourceOffset !== null && sourceOffset >= 0 && sourceOffset <= source.length) return clamp(map.toInput(sourceOffset));
  const mirrored = mirrorOffset({doc, win, input, clientX, clientY});
  return clamp(mirrored ?? input.value.length);
}
