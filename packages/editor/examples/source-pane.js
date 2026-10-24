import { createEditorSession } from '../src/index.js';
import { createSourcePane } from '../src/source-pane.js';
import { gallery as defaultCatalog } from '@openpresentation/gallery';

// Harness for the source pane (RR-98): the pane on the left, the session document and the host callbacks on the right.
const deck = {
  name: 'Minimal OPF Deck',
  slides: [
    { title: 'OWAA Rocks!' },
    { title: 'What This Shows', items: ['A title slide', 'A simple list slide', 'A closing slide'] },
    { title: 'Next Steps', text: 'Use this as a small valid OPF starting point.' },
  ],
};
// The JSON the author wrote: tabs and a compact slide that exact-source keeps byte for byte.
const source = `{
  "name": "Minimal OPF Deck",
  "slides": [
    { "title": "OWAA Rocks!" },
    {
      "title": "What This Shows",
      "items": ["A title slide", "A simple list slide", "A closing slide"]
    },
    { "title": "Next Steps", "text": "Use this as a small valid OPF starting point." }
  ]
}
`;
const query = new URLSearchParams(location.search);
function workerOption(mode) {
  if (mode === 'off') return false;
  if (mode === 'throw') return () => { throw new Error('The worker could not be created.'); };
  if (mode === 'missing') return () => new Worker('./no-such-worker.js', { type: 'module' });
  return () => new Worker('./source-worker.js', { type: 'module' });
}
// The default catalog is registered, so the pane offers layouts and tones as you type and in the field menu.
const editor = createEditorSession(query.get('deck') === 'broken'
  ? { name: 'Broken deck', slides: [{ title: 42 }, { title: 'Agenda', items: 'One string, not an array' }] }
  : deck, { catalogs: [defaultCatalog] });
const log = [];
const errors = [];
const note = (entry) => { log.push(entry); document.getElementById('log').textContent = JSON.stringify(log, null, 1); };
const pane = createSourcePane(document.getElementById('pane'), {
  editor,
  source: query.get('deck') === 'broken' ? undefined : source,
  name: 'deck',
  format: query.get('format') ?? 'json',
  density: query.get('density') === 'touch' ? 'touch' : 'comfortable',
  applyDelay: Number(query.get('applyDelay') ?? 50),
  outline: query.get('outline') === 'open' ? 'open' : query.get('outline') === 'on',
  // The text checks run in a Web Worker (the page's own bundle of src/source-worker.js); ?worker=off keeps them on the main thread. The tests also
  // start it broken (?worker=throw: the factory throws; ?worker=missing: the script URL answers 404) to see the pane fall back to the main thread.
  worker: workerOption(query.get('worker')),
  completions: query.get('completions') !== 'off',
  smartListEnter: query.get('smartListEnter') !== 'off',
  onError: (error) => errors.push(String(error?.message ?? error)),
  // ?preview=on: the host supplies a preview for the card of a record only the app provides (F12 on a layout of the default catalog).
  resolvePreview: query.get('preview') === 'on' ? (kind, id) => { const node = document.createElement('div'); node.className = 'demo-preview'; node.textContent = `Preview of ${kind} ${id}`; return node; } : undefined,
  onRename: (name) => note({ rename: name }),
  onFormatChange: (format, previous) => note({ format, previous }),
  onFindingSelect: (finding, line) => note({ select: finding.path, line }),
});
// The session document beside the pane. A large deck is not printed on every edit: that would be the page's own main-thread cost, not the editor's.
const doc = document.getElementById('doc');
const show = () => {
  const text = JSON.stringify(editor.presentation, null, 1);
  doc.textContent = text.length > 20000 ? `${text.slice(0, 20000)}\n... (${text.length} characters)` : text;
};
let shown = null;
editor.subscribe(() => { if (shown === null) shown = setTimeout(() => { shown = null; show(); }, 120); });
show();
document.getElementById('demo-undo').onclick = () => editor.undo();
document.getElementById('demo-redo').onclick = () => editor.redo();
document.getElementById('demo-rename-slide').onclick = () => editor.set('slides.0.title', 'Retitled outside the source');
document.getElementById('demo-add-design').onclick = () => editor.set('slides.0.design', { layout: 'title' });
document.getElementById('demo-touch').onclick = () => pane.setDensity('touch');
let readOnly = false;
document.getElementById('demo-readonly').onclick = () => { readOnly = !readOnly; pane.setReadOnly(readOnly); };
window.demo = { editor, get pane() { return pane; }, log, errors, createSourcePane, createEditorSession };
