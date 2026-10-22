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
// The default catalog is registered, so the pane offers layouts and tones as you type and in the field menu.
const editor = createEditorSession(query.get('deck') === 'broken'
  ? { name: 'Broken deck', slides: [{ title: 42 }, { title: 'Agenda', items: 'One string, not an array' }] }
  : deck, { catalogs: [defaultCatalog] });
const log = [];
const note = (entry) => { log.push(entry); document.getElementById('log').textContent = JSON.stringify(log, null, 1); };
const pane = createSourcePane(document.getElementById('pane'), {
  editor,
  source: query.get('deck') === 'broken' ? undefined : source,
  name: 'deck',
  format: query.get('format') ?? 'json',
  density: query.get('density') === 'touch' ? 'touch' : 'comfortable',
  applyDelay: 50,
  completions: query.get('completions') !== 'off',
  onRename: (name) => note({ rename: name }),
  onFormatChange: (format, previous) => note({ format, previous }),
  onFindingSelect: (finding, line) => note({ select: finding.path, line }),
});
const show = () => { document.getElementById('doc').textContent = JSON.stringify(editor.presentation, null, 1); };
editor.subscribe(show);
show();
document.getElementById('demo-undo').onclick = () => editor.undo();
document.getElementById('demo-redo').onclick = () => editor.redo();
document.getElementById('demo-rename-slide').onclick = () => editor.set('slides.0.title', 'Retitled outside the source');
document.getElementById('demo-add-design').onclick = () => editor.set('slides.0.design', { layout: 'title' });
document.getElementById('demo-touch').onclick = () => pane.setDensity('touch');
let readOnly = false;
document.getElementById('demo-readonly').onclick = () => { readOnly = !readOnly; pane.setReadOnly(readOnly); };
window.demo = { editor, get pane() { return pane; }, log, createSourcePane, createEditorSession };
