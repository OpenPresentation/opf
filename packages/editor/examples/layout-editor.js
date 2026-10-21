import { toSvg } from '@openpresentation/opf-render/svg';
import { createEditorSession } from '../src/index.js';
import { applyLayoutToSlide, createLayoutCanvas, createLayoutEditor, createLayoutInspector, createLayoutModel, createLayoutToolPalette, createLayoutTree, saveLayoutToDeck } from '../src/layout-editor.js';

// Harness for the layout editor (RR-99). ?parts=1 arranges the four parts separately around one shared model; ?density=touch,
// ?dark=1, ?readonly=1, ?layout=hero|blank|row choose the starting record; ?render=0 turns the host renderer off (Preview draws a wireframe).
const query = new URLSearchParams(location.search);
if (query.get('dark') === '1') document.documentElement.setAttribute('data-theme', 'dark');
const records = {
  blank: { id: 'my-layout', name: 'My layout', direction: 'column', regions: [{ name: 'title' }, { name: 'content' }] },
  hero: { id: 'hero-copy', name: 'Hero copy', summary: 'A lead message with a picture and supporting points.', direction: 'column', anchor: 'middle', regions: [{ name: 'title' }, { direction: 'row', size: 2, regions: [{ name: 'lead', accepts: ['text', 'quote', 'metric'], flow: 'none' }, { name: 'media', accepts: ['image', 'video'], role: 'media', flow: 'none' }] }, { name: 'support', size: 1, accepts: ['text', 'list', 'metric', 'group'], role: 'supporting', flow: 'grid' }], design: { imageFit: 'contain' } },
  row: { id: 'story', name: 'Story and evidence', direction: 'row', regions: [{ name: 'main', size: 2, accepts: ['text'] }, { name: 'aside', size: 1, accepts: ['metric'] }] },
  broken: { id: 'broken', name: 'Broken', direction: 'row', regions: [{ name: 'a' }, { name: 'a' }, { name: 'b', size: 'auto' }] },
};
const start = structuredClone(records[query.get('layout') ?? 'hero'] ?? records.hero);
const deck = { name: 'Layout deck', slides: [{ id: 'one', title: 'First slide', text: 'Some text.' }, { id: 'two', title: 'Second slide' }] };
const session = createEditorSession(deck);
const log = [];
const note = (entry) => { log.push(entry); render(); };
const density = query.get('density') === 'touch' ? 'touch' : 'comfortable';
const common = { record: start, density, readOnly: query.get('readonly') === '1', onChange: (record) => note({ change: record.name, regions: record.regions.length }), ...(query.get('render') === '0' ? {} : { toSvg }) };
let editor, model, parts = null;
if (query.get('parts') === '1') {
  document.body.classList.add('arranged');
  model = createLayoutModel(common);
  const shared = { model, ...(common.toSvg ? { toSvg: common.toSvg } : {}) };
  parts = {
    palette: createLayoutToolPalette(document.getElementById('p-palette'), { ...shared, orientation: 'horizontal' }),
    canvas: createLayoutCanvas(document.getElementById('p-canvas'), shared),
    layers: createLayoutTree(document.getElementById('p-layers'), { model }),
    inspector: createLayoutInspector(document.getElementById('p-inspector'), { model }),
  };
  editor = { getRecord: () => model.getRecord(), setRecord: (record) => model.setRecord(record), model, parts };
} else {
  editor = createLayoutEditor(document.getElementById('editor'), common);
  model = editor.model;
}
function render() {
  document.getElementById('log').textContent = JSON.stringify({ record: model.record, deck: session.presentation.catalogs ?? null, slides: session.presentation.slides.map((slide) => slide.layout ?? null), events: log }, null, 1);
}
const result = document.getElementById('result');
const attempt = (callback) => { try { const change = callback(); result.textContent = `ok${change?.layoutId ? ` · ${change.layoutId}` : ''}`; note({ ok: change?.layoutId ?? true }); } catch (error) { result.textContent = error.code ? `${error.code}: ${error.message}` : error.message; note({ error: error.message }); } };
document.getElementById('save').onclick = () => attempt(() => saveLayoutToDeck(session, model));
document.getElementById('replace').onclick = () => attempt(() => saveLayoutToDeck(session, model, { replace: true }));
document.getElementById('apply').onclick = () => attempt(() => applyLayoutToSlide(session, model, 0));
document.getElementById('load-hero').onclick = () => editor.setRecord(structuredClone(records.hero));
document.getElementById('blank').onclick = () => editor.setRecord(structuredClone(records.blank));
session.subscribe(render);
render();
window.demo = { editor, model, session, log, records, toSvg, createLayoutEditor, createEditorSession };
