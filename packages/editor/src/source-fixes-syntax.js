// Quick fixes for the syntax problems of a YAML or Markdown source (artifacts/source-editor/VALIDATOR-HINTS.md, sections 9, 10 and 12): "Convert tabs to
// spaces", "Insert closing quote", "Insert ]", "Add a colon", "Insert ---", "Insert closing fence", "Insert -->", "Rename to layout", "Insert column" and
// the like. The YAML ones are core's (`analyzeYamlSyntax` returns the edits with the problem); the Markdown ones are found here from the finding's range and
// core's `scanMarkdown`. Pure functions over the source text: each fix is `{ id, title, safe, edits: [{ from, to, insert }], caret? }`, source offsets in, so
// the editor applies it as one undoable change that keeps the author's comments and layout.
import { analyzeYamlSyntax, scanMarkdown } from "@openpresentation/opf/source";

const lineStart = (text, offset) => text.lastIndexOf("\n", offset - 1) + 1;
const lineEnd = (text, offset) => { const at = text.indexOf("\n", offset); return at < 0 ? text.length : at; };
const nextLine = (text, offset) => { const end = lineEnd(text, offset); return end < text.length ? end + 1 : end; };
const fix = (id, title, edits, extra = {}) => ({ id, title, safe: false, edits, ...extra });
const fromCore = (entry) => ({ id: entry.id, title: entry.title, safe: entry.safe === true, edits: entry.edits.map((edit) => ({ from: edit.offset, to: edit.offset + edit.length, insert: edit.insert })), ...(entry.caret !== undefined ? { caret: entry.caret } : {}) });

// ---- YAML -------------------------------------------------------------------------------------------------------------------------
const yamlMemo = { text: null, problems: [] };
function yamlProblems(text) {
  if (yamlMemo.text !== text) { yamlMemo.text = text; yamlMemo.problems = analyzeYamlSyntax(text); }
  return yamlMemo.problems;
}

/** The YAML regions of a Markdown text: its front matter and its `opf-slide` and `opf-block` fences, as `{ from, to }` of the YAML itself. */
function markdownYamlRegions(text) {
  const scan = scanMarkdown(text);
  const regions = [];
  if (scan.frontMatter) regions.push({ from: scan.frontMatter.yamlFrom, to: scan.frontMatter.yamlTo });
  for (const fence of scan.fences) if (fence.kind === "opf-slide" || fence.kind === "opf-block") regions.push({ from: fence.bodyFrom, to: fence.bodyTo });
  return regions;
}

/** The problem that starts where `finding` does, in the YAML `text` (`shift` is where `text` starts in the source). */
function yamlHit(problems, finding, shift) {
  const at = (finding.location?.offset ?? finding.range?.from) - shift;
  return problems.find((problem) => problem.range.offset === at);
}

function yamlSyntax(format, text, finding) {
  if (format === "yaml") {
    const hit = yamlHit(yamlProblems(text), finding, 0);
    return hit ? { fixes: hit.fixes.map(fromCore), related: (hit.related ?? []).map((range) => ({ from: range.offset, to: range.offset + range.length })) } : null;
  }
  const at = finding.location?.offset ?? finding.range?.from;
  const region = markdownYamlRegions(text).find((entry) => at >= entry.from && at <= entry.to);
  if (!region) return null;
  const slice = text.slice(region.from, region.to);
  const hit = yamlHit(analyzeYamlSyntax(slice, { rootKind: "any" }), finding, region.from);
  if (!hit) return null;
  const shift = (offset) => offset + region.from;
  return {
    fixes: hit.fixes.map(fromCore).map((entry) => ({ ...entry, edits: entry.edits.map((edit) => ({ ...edit, from: shift(edit.from), to: shift(edit.to) })), ...(entry.caret !== undefined ? { caret: shift(entry.caret) } : {}) })),
    related: (hit.related ?? []).map((range) => ({ from: shift(range.offset), to: shift(range.offset + range.length) })),
  };
}

// ---- Markdown ---------------------------------------------------------------------------------------------------------------------

/** The end of the last non-blank line inside [from, to). */
function lastContentEnd(text, from, to) {
  let end = Math.min(to, text.length);
  while (end > from && /\s/.test(text[end - 1])) end--;
  return end;
}

/** Where a front matter that was never closed should end: before the first blank line or the first line that is not YAML-shaped. */
function frontMatterEnd(text) {
  const YAMLISH = /^(\s*[A-Za-z_][\w.-]*\s*:|\s*-\s|\s+\S|\s*#(?!\s)|\s*#\s*$|\s*#\s.*$)/;
  let at = nextLine(text, 0);
  let seen = false;
  while (at < text.length) {
    const end = lineEnd(text, at);
    const content = text.slice(at, end);
    if (content.trim() === "" || (!YAMLISH.test(content) && seen)) return at;
    if (/^#{1,6}\s/.test(content) && !/^#\s.*:\s/.test(content)) return at;
    seen = true;
    at = nextLine(text, at);
  }
  return text.length;
}

/** Remove the whole lines that [from, to) touches. */
const removeLines = (text, from, to) => ({ from: lineStart(text, from), to: nextLine(text, Math.max(from, to - 1)), insert: "" });

const markdownRules = {
  "markdown/front-matter-unterminated": (text) => {
    const at = frontMatterEnd(text);
    const prefix = at > 0 && text[at - 1] !== "\n" ? "\n" : "";
    return [fix("insert-front-matter-end", "Insert ---", [{ from: at, to: at, insert: `${prefix}---\n` }], { safe: true })];
  },
  "markdown/comment-unterminated": (text, finding) => {
    const from = finding.location.offset;
    const end = lastContentEnd(text, from, from + finding.location.length);
    return [fix("insert-comment-end", "Insert -->", [{ from: end, to: end, insert: " -->" }], { safe: true, caret: end + 4 })];
  },
  "markdown/fence-unterminated": (text, finding) => {
    const from = finding.location.offset;
    const opening = text.slice(lineStart(text, from), lineEnd(text, from));
    const marker = /^\s*(`{3,}|~{3,})/.exec(opening)?.[1] ?? "```";
    const end = lastContentEnd(text, from, from + finding.location.length);
    const at = nextLine(text, end > from ? end - 1 : from);
    const prefix = at === text.length && !text.endsWith("\n") ? "\n" : "";
    return [fix("insert-closing-fence", "Insert closing fence", [{ from: at, to: at, insert: `${prefix}${marker}\n` }], { safe: true })];
  },
  "markdown/options-unknown-key": (text, finding) => {
    const key = /option "(.*)"\.$/.exec(finding.message)?.[1];
    const { offset, length } = finding.location;
    const found = key ? new RegExp(`(^|[\\s:])(${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?==|\\s|-->|$)`).exec(text.slice(offset, offset + length)) : null;
    if (!found) return [];
    const from = offset + found.index + found[1].length;
    return (finding.suggestions ?? []).map((entry) => fix(`rename-to:${entry.value}`, `Rename to ${entry.value}`, [{ from, to: from + key.length, insert: String(entry.value) }]));
  },
  "markdown/options-value": (text, finding) => {
    if (!/^hidden takes/.test(finding.message)) return [];
    const { offset, length } = finding.location;
    const found = /\bhidden=("[^"]*"|\S+?)(?=\s|-->)/.exec(text.slice(offset, offset + length));
    if (!found) return [];
    const from = offset + found.index;
    return ["true", "false"].map((value) => fix(`hidden-${value}`, `Use hidden=${value}`, [{ from, to: from + found[0].length, insert: `hidden=${value}` }]));
  },
  "markdown/options-duplicate": (text, finding) => {
    const key = /^Option (\w+) is given twice/.exec(finding.message)?.[1];
    if (!key) return [];
    const { offset, length } = finding.location;
    const body = text.slice(offset, offset + length);
    const pattern = new RegExp(`\\s${key}=("[^"]*"|[^\\s>]+)`, "g");
    const matches = [...body.matchAll(pattern)];
    if (matches.length < 2) return [];
    const second = matches[1];
    return [fix("remove-duplicate-option", `Remove the second ${key}`, [{ from: offset + second.index, to: offset + second.index + second[0].length, insert: "" }])];
  },
  "markdown/chart-type": (text, finding) => {
    const open = lineStart(text, finding.location.offset);
    const line = text.slice(open, lineEnd(text, open));
    const found = /^(\s*(?:`{3,}|~{3,})\s*chart)/.exec(line);
    if (!found) return [];
    const at = open + found[1].length;
    return (finding.suggestions ?? []).map((entry) => fix(`chart-type:${entry.value}`, `Insert ${entry.value}`, [{ from: at, to: at, insert: ` ${entry.value}` }]));
  },
  "markdown/front-matter-slides": (text, finding) => {
    const { offset, length } = finding.location;
    return [fix("remove-slides-key", "Remove the slides key", [removeLines(text, offset, offset + length)])];
  },
  "markdown/no-slides": (text) => {
    const empty = text.trim() === "";
    return [fix("insert-title", "Insert # Title", [{ from: text.length, to: text.length, insert: empty ? "# Title\n" : `${text.endsWith("\n") ? "" : "\n"}\n# Title\n` }], { safe: true })];
  },
  "markdown/duplicate-title": (text, finding) => {
    const open = lineStart(text, finding.location.offset);
    return [
      fix("start-new-slide", "Start a new slide here", [{ from: open, to: open, insert: "---\n\n" }]),
      fix("remove-extra-heading", "Remove the extra heading", [removeLines(text, open, lineEnd(text, open))]),
    ];
  },
  "markdown/duplicate-subtitle": (text, finding) => {
    const open = lineStart(text, finding.location.offset);
    return [fix("remove-extra-heading", "Remove the extra heading", [removeLines(text, open, lineEnd(text, open))])];
  },
  "markdown/empty-heading": (text, finding) => {
    const open = lineStart(text, finding.location.offset);
    return [fix("remove-empty-heading", "Remove the heading", [removeLines(text, open, lineEnd(text, open))])];
  },
  "markdown/numbered-list": (text, finding) => {
    const { offset, length } = finding.location;
    const scan = scanMarkdown(text);
    const slide = scan.slides.find((entry) => offset >= entry.from && offset <= entry.to);
    // A slide that has an opf-slide fence already gets the field written into it, not a second fence.
    if (slide && scan.fences.some((fence) => fence.kind === "opf-slide" && fence.from >= slide.from && fence.to <= slide.to + 1)) return [];
    const end = lastContentEnd(text, offset, offset + length);
    const at = nextLine(text, end > offset ? end - 1 : offset);
    const prefix = at === text.length && !text.endsWith("\n") ? "\n" : "";
    return [fix("add-numbering", "Add `numbering`", [{ from: at, to: at, insert: `${prefix}\n\`\`\`opf-slide\nnumbering: arabic\n\`\`\`\n` }])];
  },
  "markdown/metric-block": (text, finding) => {
    if (finding.message !== "A metric needs a value.") return [];
    const open = lineStart(text, finding.location.offset);
    const at = nextLine(text, open);
    return [fix("insert-metric-value", "Insert value:", [{ from: at, to: at, insert: "value: 0\n" }])];
  },
};

/** The quick fixes of a YAML or Markdown syntax finding, and the other places that belong to it: `{ fixes, related }` or null. */
export function syntaxFixesFor(format, text, finding) {
  if (!finding?.location || format === "json") return null;
  const id = String(finding.ruleId ?? "");
  try {
    if (id.startsWith("yaml/") || (format === "md" && (id === "markdown/front-matter" || id === "markdown/opf-slide" || id === "markdown/opf-block"))) return yamlSyntax(format, text, finding);
    const make = markdownRules[id];
    if (make) {
      const fixes = make(text, finding).filter((entry) => entry.edits.length);
      return fixes.length ? { fixes, related: [] } : null;
    }
  } catch { /* A fix that cannot be worked out is not offered. */ }
  return null;
}

/**
 * Findings of a YAML or Markdown source with their quick fixes (`editFixes`) and related places (`related`) added, in the shape `normalizeFinding` and
 * `buildProblems` read. Findings that have no fixes are returned as they are.
 */
export function withSyntaxFixes(format, text, findings) {
  return findings.map((finding) => {
    const made = syntaxFixesFor(format, text, finding);
    if (!made) return finding;
    return { ...finding, ...(made.fixes.length ? { editFixes: made.fixes } : {}), ...(made.related.length ? { related: made.related } : {}) };
  });
}
