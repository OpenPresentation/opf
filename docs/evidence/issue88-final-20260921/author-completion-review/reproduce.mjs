import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire, registerHooks, stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';

const worktree = '/private/tmp/opf-issue88-explicit-formatting-20260921/pptx-dev';
const output = '/private/tmp/opf-author-completion-review-20260921';
const require = createRequire(`${worktree}/package.json`);
const sha = value => createHash('sha256').update(value).digest('hex');
const publicOptions = require.resolve('@openpresentation/opf-editor/json-options');
const options = await import(pathToFileURL(publicOptions));
const { getJsonFieldContext, fieldOptionEdit, replaceFieldOption } = options;

// Load Monaco's unmodified CompletionItem constructor. These globals and CSS
// handling permit module initialization only; no DOM/suggest-widget acceptance
// or browser undo claim is made by this Node harness.
globalThis.window = globalThis;
globalThis.location = { href: 'http://localhost/' };
globalThis.HTMLElement = class {};
globalThis.customElements = { define() {}, get() {} };
registerHooks({ load(url, context, nextLoad) {
  return url.endsWith('.css')
    ? { format: 'module', source: '', shortCircuit: true }
    : nextLoad(url, context);
} });
const monacoSuggest = require.resolve('monaco-editor/editor/contrib/suggest/browser/suggest.js');
const { CompletionItem } = await import(pathToFileURL(monacoSuggest));
const { CompletionModel, LineContext } = await import(pathToFileURL(require.resolve('monaco-editor/editor/contrib/suggest/browser/completionModel.js')));
const { Range } = await import(pathToFileURL(require.resolve('monaco-editor/editor/common/core/range.js')));
const { Position } = await import(pathToFileURL(require.resolve('monaco-editor/editor/common/core/position.js')));
const adapterPath = `${worktree}/lib/playground/register-json-field-completion.ts`;
const adapterSource = await readFile(adapterPath, 'utf8');
const adapterJs = stripTypeScriptTypes(adapterSource).replace('"@openpresentation/opf-editor/json-options"', JSON.stringify(pathToFileURL(publicOptions).href));
const adapter = await import(`data:text/javascript;base64,${Buffer.from(adapterJs).toString('base64')}`);
const parserPath = `${worktree}/lib/playground/json-cursor-resolver.ts`;
const parserSource = await readFile(parserPath, 'utf8');
const { parseJsonSource } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(parserSource, { mode: 'transform' })).toString('base64')}`);
let provider;
adapter.registerJsonFieldCompletion({ languages: {
  CompletionItemKind: { EnumMember: 16 },
  registerCompletionItemProvider(_language, value) { provider = value; return { dispose() {} }; },
} });
const catalogs = { layouts: [{ id: 'loaded-layout', name: 'AAB Loaded Layout', placeholders: [{ type: 'title' }, { type: 'text' }] }] };
adapter.setJsonFieldCatalogs(catalogs);

const tracePath = '/private/tmp/opf-issue88-final-production-20260921/author-last-copied-source.json';
const original = await readFile(tracePath, 'utf8');
await writeFile(`${output}/original-source.json`, original);
function modelFor(source) {
  return {
    getValue: () => source,
    getPositionAt(offset) {
      const before = source.slice(0, offset);
      return new Position(before.split('\n').length, offset - before.lastIndexOf('\n'));
    },
    getOffsetAt(position) {
      let start = 0;
      for (let line = 1; line < position.lineNumber; line++) start = source.indexOf('\n', start) + 1;
      return start + position.column - 1;
    },
  };
}
function inspect(source, offset) {
  const model = modelFor(source), position = model.getPositionAt(offset);
  const context = getJsonFieldContext(source, offset, catalogs);
  const suggestions = provider.provideCompletionItems(model, position).suggestions;
  return { position, context: context && { path: context.path, offset: context.offset, length: context.length, value: context.value },
    suggestions: suggestions.map(suggestion => ({ ...suggestion,
      actualMonacoIsInvalid: new CompletionItem(position, suggestion, { suggestions }, provider).isInvalid,
      documentedRangeContainsCursor: Range.containsPosition(suggestion.range, position),
    })) };
}
const offset = original.indexOf('"document-layout"') + 1;
const originalResult = inspect(original, offset);
assert.equal(originalResult.suggestions.length, 32);
assert.equal(originalResult.suggestions.filter(item => !item.actualMonacoIsInvalid).length, 4);
assert.equal(originalResult.suggestions.find(item => item.label === 'AAA Document Layout').actualMonacoIsInvalid, true);
assert.equal(originalResult.suggestions.find(item => item.label === 'AAB Loaded Layout').actualMonacoIsInvalid, false);

// Read-only candidate mapping proof. Find the exact scalar by its existing JSON
// path, avoiding string searches, then split desired source changes before and
// after it. Reuse the app's existing parser; no transitive parser dependency.
function find(root, path) {
  return path.reduce((node, key) => node.type === 'array' ? node.items[key] : node.entries.find(entry => entry.key === key)?.value, root);
}
function minimalEdit(before, after, base) {
  if (before === after) return [];
  let from = 0, to = before.length, end = after.length;
  while (from < to && from < end && before[from] === after[from]) from++;
  while (to > from && end > from && before[to - 1] === after[end - 1]) { to--; end--; }
  return [{ from: base + from, to: base + to, insert: after.slice(from, end) }];
}
function proposal(context, value, requestedOffset) {
  const source = context.source, model = modelFor(source);
  // Exact current spelling must be retained, including JSON escapes.
  const next = value === context.value ? source : replaceFieldOption(context, value);
  const newNode = find(parseJsonSource(next), context.path);
  assert(newNode && JSON.parse(next.slice(newNode.start, newNode.end)) === value);
  const start = context.offset, end = start + context.length;
  assert(requestedOffset >= start && requestedOffset <= end, 'Only scalar-contained completion requests in this prototype');
  const main = { from: start, to: end, insert: next.slice(newNode.start, newNode.end) };
  const additional = [
    ...minimalEdit(source.slice(0, start), next.slice(0, newNode.start), 0),
    ...minimalEdit(source.slice(end), next.slice(newNode.end), end),
  ];
  const edits = [main, ...additional].sort((a, b) => b.from - a.from);
  for (let i = 0; i < edits.length - 1; i++) assert(edits[i + 1].to <= edits[i].from, 'No overlapping edits');
  const apply = edits.reduce((current, edit) => current.slice(0, edit.from) + edit.insert + current.slice(edit.to), source);
  assert.equal(apply, next);
  const makeRange = edit => Range.fromPositions(model.getPositionAt(edit.from), model.getPositionAt(edit.to));
  const option = context.options.find(option => option.value === value);
  const item = { label: option.label, kind: 16, range: makeRange(main), insertText: main.insert,
    filterText: `${JSON.stringify(option.label)} ${main.insert}`,
    insertTextRules: 1, // CompletionItemInsertTextRule.KeepWhitespace
    additionalTextEdits: additional.map(edit => ({ range: makeRange(edit), text: edit.insert })),
  };
  const position = model.getPositionAt(requestedOffset);
  assert.equal(new CompletionItem(position, item, { suggestions: [item] }, {}).isInvalid, false);
  assert(Range.containsPosition(item.range, position));
  return { item, sourceSha256: sha(source), desiredSha256: sha(next), additionalCount: additional.length,
    exactReconstruction: true, currentValueNoop: value === context.value ? next === source : undefined };
}
const proof = [];
for (const [eol, source] of [['CRLF', original], ['LF', original.replaceAll('\r\n', '\n')]]) {
  const context = getJsonFieldContext(source, source.indexOf('"document-layout"') + 1, catalogs);
  for (const option of context.options) {
    for (const cursor of [context.offset, context.offset + 1, context.offset + 7, context.offset + context.length]) {
      proof.push({ eol, option: option.label, cursorOffset: cursor, ...proposal(context, option.value, cursor) });
    }
  }
}
const escaped = original.replace('"document-layout"', '"document-\\u006cayout"');
const escapedContext = getJsonFieldContext(escaped, escaped.indexOf('"document-\\u006cayout"') + 1, catalogs);
const publishedEscapedNoop = replaceFieldOption(escapedContext, escapedContext.value);
assert.notEqual(escaped, publishedEscapedNoop);
const escapedProof = proposal(escapedContext, escapedContext.value, escapedContext.offset + 1);
const themeOffset = original.indexOf('"dark"') + 1;
const theme = inspect(original, themeOffset);
const middleToken = inspect(original, offset + 12);
const keyRequest = inspect(original, original.indexOf('"layout"') + 2);
const originalContext = getJsonFieldContext(original, offset, catalogs);
const proposedItems = originalContext.options.map(option => proposal(originalContext, option.value, offset).item);
function visible(suggestions) {
  const position = modelFor(original).getPositionAt(offset);
  const lineStart = original.lastIndexOf('\n', offset - 1) + 1;
  return new CompletionModel(suggestions.map(item => new CompletionItem(position, item, { suggestions }, provider)),
    position.column, new LineContext(original.slice(lineStart, offset), 0), { distance: () => 0 },
    { filterGraceful: true }, 'inline').items.map(item => item.completion.label);
}
const fullTokenFilterProof = {
  // Naively retaining the old unquoted filterText would hide every proposal.
  oldUnquotedFilterVisible: visible(proposedItems.map((item, i) => ({ ...item, filterText: originalResult.suggestions[i].filterText }))),
  quotedFilterVisible: visible(proposedItems),
};
assert.equal(fullTokenFilterProof.oldUnquotedFilterVisible.length, 0);
assert.equal(fullTokenFilterProof.quotedFilterVisible.length, 32);
const report = {
  runtime: { node: process.version, platform: process.platform, arch: process.arch },
  publicResolution: { jsonOptions: publicOptions, jsonOptionsSha256: sha(await readFile(publicOptions)),
    monacoSuggest, monacoSuggestSha256: sha(await readFile(monacoSuggest)),
    editorVersion: require('@openpresentation/opf-editor/package.json').version, monacoVersion: '0.56.0' },
  inputs: { adapterPath, adapterSha256: sha(adapterSource), parserPath, parserSha256: sha(parserSource),
    tracePath, sourceSha256: sha(original), pnpmLockSha256: sha(await readFile(`${worktree}/pnpm-lock.yaml`)) },
  actualConstructorBoundary: 'Unmodified Monaco constructor, CSS ignored and browser module-init globals supplied. No browser popup, acceptance, undo or stale-session guarantee inferred.',
  counts: { total: originalResult.suggestions.length, rejected: originalResult.suggestions.filter(item => item.actualMonacoIsInvalid).length,
    prototypeCases: proof.length, prototypeExactReconstructionCases: proof.filter(item => item.exactReconstruction).length },
  originalResult, theme, middleToken, keyRequest, fullTokenFilterProof,
  escapedCurrentValue: { originalSha256: sha(escaped), publishedNoopSha256: sha(publishedEscapedNoop), publishedNormalizesToken: true, proposal: escapedProof },
  proposalProof: proof,
};
await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report.counts, escapedCurrentValuePreservedByProposal: escapedProof.currentValueNoop, publicResolution: report.publicResolution }, null, 2));
