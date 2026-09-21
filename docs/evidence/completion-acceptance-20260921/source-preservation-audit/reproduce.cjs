// Source-only audit. Executes current codec/bridge and published editor API;
// no React mount, browser, network, or application file changes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const root = '/private/tmp/opf-completion-fix-20260921/pptx-dev';
const output = __dirname;
const appRequire = createRequire(path.join(root, 'package.json'));
const ts = appRequire('typescript');
require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  module._compile(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText, filename);
};
const { convert, toJsonText } = appRequire('./lib/playground/opf-codec.ts');
const { createCanvasSourceBridge } = appRequire('./lib/playground/canvas-source.ts');
const { createEditorSession } = appRequire('@openpresentation/opf-editor');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const summary = text => ({ bytes: Buffer.byteLength(text), sha256: digest(text), crlf: (text.match(/\r\n/g) || []).length, tabs: (text.match(/\t/g) || []).length });
const originalLF = '{\n\t"name" : "Keep\\u0020escapes",\n\t"extensions": {"human": {"x": 1e2, "literal": "a\\/b"}},\n'
  + '\t"design": {"fontScheme":"roboto"},\n'
  + '\t"slides" : [ { "id":"first", "title" : "A\\u0020title", "text" : [{"text":"rich  text", "bold":true, "color":"accent2"}], "notes":"keep\\n\\t" },\n'
  + '\t  {"id":"second","title":"Second", "text":"body"} ]\n}\n';
const cases = [];
for (const eol of ['LF', 'CRLF']) {
  const original = eol === 'LF' ? originalLF : originalLF.replace(/\n/g, '\r\n');
  const document = JSON.parse(original);
  const editor = createEditorSession(document, { rejectInvalid: true });
  const validation = editor.validation;
  if (!validation.valid) throw new Error(JSON.stringify(validation));
  const expectedEdited = original.replace('"A\\u0020title"', '"Edited title"');
  // Author current onCanvasDocumentChange (author-shell.tsx:780-785).
  let authorSource = original;
  editor.subscribe(event => {
    if (event.meta?.source === 'source-buffer') return;
    const converted = convert(toJsonText(event.snapshot.document), 'json', 'json');
    if (!converted.ok) throw new Error(converted.error);
    authorSource = converted.text;
  });
  const noEditCanvasRead = convert(toJsonText(editor.document), 'json', 'json').text;
  const codeTabDownload = convert(original, 'json', 'json').text;
  const inspectorDownload = toJsonText(document);
  editor.set('slides.0.title', 'Edited title', { source: 'canvas', rejectInvalid: true });
  const afterEdit = authorSource;
  editor.undo();
  const afterUndo = authorSource;
  editor.redo();
  const afterRedo = authorSource;
  // Existing Inspector bridge demonstrates the local reuse opportunity with
  // the same published editor events. This does not claim Author integration.
  const bridgedEditor = createEditorSession(document, { rejectInvalid: true });
  const bridge = createCanvasSourceBridge();
  let bridgedSource = original, previous = bridgedEditor.document;
  bridgedEditor.subscribe(event => {
    bridgedSource = bridge.apply({ text: bridgedSource, format: 'json' }, { before: previous, after: event.snapshot.document, event });
    previous = event.snapshot.document;
  });
  bridgedEditor.set('slides.0.title', 'Edited title', { source: 'canvas', rejectInvalid: true });
  const bridgeAfterEdit = bridgedSource;
  bridgedEditor.undo(); const bridgeAfterUndo = bridgedSource;
  bridgedEditor.redo(); const bridgeAfterRedo = bridgedSource;
  const bytes = { original, expectedEdited, noEditCanvasRead, codeTabDownload, inspectorDownload, afterEdit, afterUndo, afterRedo, bridgeAfterEdit, bridgeAfterUndo, bridgeAfterRedo };
  for (const [label, value] of Object.entries(bytes)) fs.writeFileSync(path.join(output, `${eol}-${label}.json`), value);
  cases.push({ eol, schemaValid: validation.valid,
    original: summary(original), values: Object.fromEntries(Object.entries(bytes).map(([key, value]) => [key, summary(value)])),
    assertions: {
      codeTabJsonDownloadExact: codeTabDownload === original,
      untouchedCanvasReadExact: noEditCanvasRead === original,
      inspectorJsonDownloadExact: inspectorDownload === original,
      authorCanvasEditMinimal: afterEdit === expectedEdited,
      authorCanvasUndoExact: afterUndo === original,
      authorCanvasRedoExact: afterRedo === expectedEdited,
      authorCanvasUndoSemantic: JSON.stringify(JSON.parse(afterUndo)) === JSON.stringify(document),
      bridgeEditMinimal: bridgeAfterEdit === expectedEdited,
      bridgeUndoExact: bridgeAfterUndo === original,
      bridgeRedoExact: bridgeAfterRedo === expectedEdited,
    },
  });
}
const result = { node: process.version, sourceOnly: true, root, cases };
fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ node: process.version, cases: cases.map(item => ({ eol: item.eol, original: item.original, serialized: item.values.noEditCanvasRead, assertions: item.assertions })) }, null, 2));
