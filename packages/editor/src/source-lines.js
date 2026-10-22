import { parseTree } from "jsonc-parser";

// Line lookup for a JSON Pointer in the three source formats of the source pane (RR-98). All functions return a
// one-based line number, or null when the path cannot be placed. JSON is exact; YAML and Markdown are best effort:
// they follow the shape `toYaml` and `toMarkdown` write (block style, one heading per slide) and fall back to the
// deepest place they could find.

/** Split a JSON Pointer ("/slides/0/title") or a dotted OPF path ("slides.0.title") into segments. */
export function pathSegments(path) {
  if (Array.isArray(path)) return path.map(String);
  if (path === undefined || path === null || path === "" || path === "/") return [];
  const text = String(path);
  const parts = text.startsWith("/") ? text.slice(1).split("/") : text.split(".");
  return parts.map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
}

/** The one-based line that holds a zero-based character offset. */
export function lineOfOffset(text, offset) {
  let line = 1;
  const end = Math.min(offset, text.length);
  for (let i = 0; i < end; i++) {
    const code = text.charCodeAt(i);
    if (code === 10 || (code === 13 && text.charCodeAt(i + 1) !== 10)) line++;
  }
  return line;
}

/** The zero-based character offset where a one-based line starts (a CRLF pair counts as one line break). */
export function offsetOfLine(text, line) {
  let current = 1;
  if (line <= 1) return 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 13 && text.charCodeAt(i + 1) === 10) continue;
    if (code === 10 || code === 13) {
      current++;
      if (current === line) return i + 1;
    }
  }
  return text.length;
}

const splitLines = (text) => text.split(/\r\n|\r|\n/);

function jsonLine(text, segments) {
  const root = parseTree(text);
  if (!root) return null;
  let node = root, target = root;
  for (const segment of segments) {
    let next;
    if (node.type === "array") {
      const index = /^\d+$/.test(segment) ? Number(segment) : -1;
      next = node.children?.[index];
    } else if (node.type === "object") {
      next = node.children?.find((property) => property.children?.[0]?.value === segment);
    }
    if (!next) break;
    target = next.type === "property" ? next.children[0] : next;
    node = next.type === "property" ? next.children[1] ?? next : next;
  }
  return lineOfOffset(text, target.offset);
}

// One YAML line as its structural entries: block sequence markers and a leading mapping key, each with its column.
const KEY = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s#'"[\]{},&*!|>%@`-][^:#]*?|-[^\s:][^:#]*?)\s*:(?=\s|$)/;
function unquote(key) {
  if (key.startsWith('"')) { try { return JSON.parse(key); } catch { return key.slice(1, -1); } }
  if (key.startsWith("'")) return key.slice(1, -1).replaceAll("''", "'");
  return key;
}
function yamlEntries(lines) {
  const parsed = [];
  let skipBelow = -1;
  lines.forEach((line) => {
    const indent = line.length - line.trimStart().length;
    const body = line.trim();
    if (!body || body.startsWith("#") || body === "---" || body === "...") { parsed.push([]); return; }
    if (skipBelow >= 0) {
      if (indent > skipBelow) { parsed.push([]); return; }
      skipBelow = -1;
    }
    const entries = [];
    let position = indent;
    while (line[position] === "-" && (position + 1 === line.length || line[position + 1] === " ")) {
      entries.push({ kind: "seq", col: position });
      position++;
      while (line[position] === " ") position++;
    }
    const rest = line.slice(position);
    const match = KEY.exec(rest);
    if (match) {
      entries.push({ kind: "key", col: position, key: unquote(match[1]) });
      if (/^[|>][-+0-9]*\s*(#.*)?$/.test(rest.slice(match[0].length).trim())) skipBelow = position;
    }
    parsed.push(entries);
  });
  return parsed;
}

function yamlLine(text, segments) {
  const lines = splitLines(text);
  const entries = yamlEntries(lines);
  let from = 0, to = lines.length, minCol = -1, found = null, sameColSeq = false;
  for (const segment of segments) {
    const isIndex = /^\d+$/.test(segment);
    let childCol = Infinity;
    for (let i = from; i < to; i++) for (const entry of entries[i]) if (entry.col > minCol) childCol = Math.min(childCol, entry.col);
    if (sameColSeq) childCol = minCol + 1;
    let hit = null, seen = 0;
    scan: for (let i = from; i < to; i++) {
      for (const entry of entries[i]) {
        if (entry.col !== childCol) continue;
        if (isIndex && entry.kind === "seq") { if (seen++ === Number(segment)) { hit = { line: i, entry }; break scan; } }
        else if (!isIndex && entry.kind === "key" && entry.key === segment) { hit = { line: i, entry }; break scan; }
      }
    }
    if (!hit) return found === null ? null : found + 1;
    found = hit.line;
    const { entry } = hit;
    // A mapping key with no inline value whose sequence sits at the key's own column ("items:" then "- a").
    const next = entries.findIndex((list, i) => i > hit.line && list.length > 0);
    sameColSeq = entry.kind === "key" && next !== -1 && entries[next][0].kind === "seq" && entries[next][0].col === entry.col
      && !lines[hit.line].slice(lines[hit.line].indexOf(":", entry.col) + 1).trim();
    let end = to;
    for (let i = hit.line + 1; i < to; i++) {
      const first = entries[i][0];
      if (!first) continue;
      if (first.col < entry.col || (first.col === entry.col && !(sameColSeq && first.kind === "seq"))) { end = i; break; }
    }
    from = hit.line;
    to = end;
    minCol = sameColSeq ? entry.col - 1 : entry.col;
  }
  return found === null ? 1 : found + 1;
}

function markdownLine(text, segments) {
  const lines = splitLines(text);
  let bodyStart = 0, frontEnd = -1;
  if (lines[0]?.trim() === "---") {
    frontEnd = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
    if (frontEnd > 0) bodyStart = frontEnd + 1; else frontEnd = -1;
  }
  const slides = [];
  let start = bodyStart, fence = false;
  const close = (end) => {
    let first = start;
    while (first < end && !lines[first].trim()) first++;
    slides.push({ start: first < end ? first : start, end });
  };
  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i];
    if (/^(```|~~~)/.test(line)) fence = !fence;
    if (!fence && line.trim() === "---") { close(i); start = i + 1; }
  }
  close(lines.length);
  if (!segments.length) return 1;
  if (segments[0] !== "slides") {
    if (frontEnd < 0) return 1;
    const inside = yamlLine(lines.slice(1, frontEnd).join("\n"), segments);
    return inside === null ? 2 : inside + 1;
  }
  if (segments.length === 1) return slides[0].start + 1;
  const slide = slides[/^\d+$/.test(segments[1]) ? Number(segments[1]) : -1];
  if (!slide) return null;
  if (segments.length === 2) return slide.start + 1;
  const within = (pattern) => {
    let inFence = false;
    for (let i = slide.start; i < slide.end; i++) {
      if (/^(```|~~~)/.test(lines[i])) { if (!inFence && pattern.test(lines[i])) return i + 1; inFence = !inFence; continue; }
      if (!inFence && pattern.test(lines[i])) return i + 1;
    }
    return null;
  };
  const key = segments[2];
  const nthItem = (n) => {
    let count = 0, inFence = false;
    for (let i = slide.start; i < slide.end; i++) {
      if (/^(```|~~~)/.test(lines[i])) { inFence = !inFence; continue; }
      if (!inFence && /^([-*+]|\d+\.)\s/.test(lines[i]) && count++ === n) return i + 1;
    }
    return within(/^\s*([-*+]|\d+\.)\s/);
  };
  const native = key === "title" ? within(/^# /)
    : key === "subtitle" ? within(/^## /)
    : key === "notes" ? within(/^Notes?:/)
    : key === "items" ? (/^\d+$/.test(segments[3] ?? "") ? nthItem(Number(segments[3])) : within(/^\s*([-*+]|\d+\.)\s/))
    : key === "text" ? within(/^(?!#|>|\s*([-*+]|\d+\.)\s|<!--|```|~~~|Notes?:)\S/)
    : null;
  if (native !== null) return native;
  const embedded = within(key === "blocks" ? /^(```|~~~)opf-block/ : /^(```|~~~)opf-slide/);
  return embedded ?? slide.start + 1;
}

/** The one-based line of a path in a source text of the given format ("json", "yaml" or "md"), or null. */
export function lineForPath(format, text, path) {
  const segments = pathSegments(path);
  if (!segments.length) return 1;
  try {
    return format === "json" ? jsonLine(text, segments)
      : format === "yaml" ? yamlLine(text, segments)
      : markdownLine(text, segments);
  } catch {
    return null;
  }
}
