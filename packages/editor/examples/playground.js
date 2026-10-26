import {installDataControls} from './data-controls.js';
import {installReviewControls} from './review-controls.js';
import {installChartControls} from './chart-controls.js';
import {installNumberingControls} from './numbering-controls.js';
import {createSchemaInspector} from '../src/schema-inspector.js';
import {installTemplateControls} from './template-controls.js';
import {installFindControls} from './find-controls.js';
import {installCropControls} from './crop-controls.js';
import {installMobileControls} from './mobile-controls.js';
import {installTransferControls} from './transfer-controls.js';
import { saveDocument } from '../src/index.js';
// CE-06: the editor library mounts the canvas, the slide row, the sorter, the outline, Layout Studio, Present, Export and the autosave over one session
// and one fonts handle (src/workspace.js). This page keeps what is the playground's own: the inspector, the source dialog, the data grid, import and the panels.
import { createOpfEditor } from '../src/workspace.js';
import { layoutOptionsFor } from '../src/workspace-measure.js';
// FA-23: the editor library ships no catalog data. This app is the host: it registers the default catalog owned and
// published by pptx.gallery and hands the session's one list to every render, check, embed and export.
import { catalogDisplay, gallery as defaultCatalog } from '@openpresentation/gallery';
import { whenFontsReady } from '../src/font-gate.js';
import * as browserFonts from '@openpresentation/opf-render/fonts-browser';
import { toSvg } from '@openpresentation/opf-render/svg';
import { pptxExporter } from './export-controls.js';
import { createDesignControls } from '../src/design-controls.js';
import { createDataGrid } from '../src/data-grid.js';
import { MAX_EXACT_SOURCE_LENGTH, createSourceMemory, findDuplicateKey, updateJsonSource } from '../src/exact-source.js';

// opf-editor#141: the handle is made with harfbuzzjs's two WASM files (served next to the page by build-playground.mjs). `subsetWasm` cuts the
// faces a downloaded SVG embeds to the slide's glyphs, `shapeWasm` has HarfBuzz shape outlined text (renderOptions `text: 'paths'`). The live
// canvas and thumbnails draw with `text: 'system'`, which embeds nothing, so they never use either.
// fonts.json holds the faces the page starts with. A build that splits the eager faces (the gallery editor) adds base-fonts.json: the
// rest of them, as separate hash-pinned files the registry loads on demand as its extra lazy faces (FF-41, renderer 0.11.7). Without it
// fonts.json carries every eager face.
const baseFaces = await fetch('./base-fonts.json').then(response => response.ok ? response.json() : []).catch(() => []);
const fontFaces = await fetch('./fonts.json').then(response => {
  if (!response.ok) throw new Error('Bundled fonts are unavailable. Rebuild the editor demo.');
  return response.json();
});
const fonts = await browserFonts.loadFonts({faces:fontFaces.map(face=>({family:face.family,weight:face.weight,italic:face.italic,license:face.license,data:Uint8Array.from(atob(face.dataUrl.split(',')[1]),character=>character.charCodeAt(0))})),substitutionPolicy:'visual',fallbackFamily:'Roboto',subsetWasm:new URL('./harfbuzz-subset.wasm',document.baseURI).href,shapeWasm:new URL('./harfbuzz.wasm',document.baseURI).href,scriptBaseUrl:'./script-fonts/',lazyFontsBaseUrl:new URL('./',document.baseURI).href,extraLazyFonts:baseFaces.map(face=>({family:face.family,weight:face.weight,italic:face.italic,license:face.license,sha256:face.sha256,url:new URL(face.file,document.baseURI).href}))});
const fontRegistry = fonts.registry;
// Script faces (Japanese, Arabic, Thai, ...) load lazily, once a document draws that script, and so do the vendored preview
// faces (Intos for the Aptos scheme, the open families): they are not in fonts.json but separate hash-pinned files the
// registry adds to the document and itself together. `fonts` is the renderer's handle: its textMeasurement lays slides out, and its
// pending and ensure are what the canvas gates on.
// FF-41: nothing renders or measures a document before this gate has loaded the faces it needs. The editor library (src/workspace.js) runs the one
// "ensure fonts, then update" path for the parts it mounts: initial load, Source Apply and the gallery handoff, import, undo and redo, font and
// language switches, slide navigation, thumbnails, previews and export. The source dialog below uses whenFontsReady(fonts, ...) itself.
const catalogs = [defaultCatalog];
const renderOptions = () => ({ catalogs: editor.catalogs });
const pendingFonts = deck => { try { return fonts.pending(deck, renderOptions()); } catch { return []; } };
// The session's composeSlide and paginateSlide take the handle's plain measurement, and that one is strict: they get the same per-document,
// script-aware measurement the canvas draws with (src/workspace-measure.js).
const layoutFor = (deck,index) => layoutOptionsFor(fonts, deck, index, editor.catalogs);
const element = id => document.getElementById(id);
const startDeck = {
  name: 'A presentation you can work on',
  catalogs: {custom: {fontSchemes: {cambria: {name:'Cambria',major:'Cambria',minor:'Cambria'}}}},
  design: { theme: 'classic', fontScheme: 'roboto' },
  slides: [{ id: 'recommendation', title: 'Start with a clear recommendation',
    composition: { mode: 'row', weights: [2, 1] },
    blocks: [
      { text: 'Click this text to edit it. The document remains plain JSON, and each change can be undone.' },
      { text: 'Try a column layout, add a slide, or edit the complete document.' },
    ] },
    { id: 'nested', title: 'Give related content its own layout', composition: {mode:'row',weights:[2,1]}, blocks: [{composition:{mode:'column'},blocks:[{text:'This column keeps related ideas together.'},{text:'Change this group to a row using the group controls.'}]},{text:'This supporting point keeps its own space.'}] },
    { id: 'overflow', title: 'Turn a long draft into readable slides', text: 'This draft preserves its words while the layout finds natural places to continue on another slide. '.repeat(65) },
    { id: 'evidence', title: 'Support the decision with evidence', items: ['Describe the situation.', 'Show what changed.', 'Make the next step specific.'] },
    {id:'data',title:'Edit the data behind the story',composition:{mode:'row'},blocks:[
      {table:{columns:['Quarter','Revenue'],rows:[['Q1',12],['Q2',18],['Q3',24]]}},
      {chart:{type:'column',data:{columns:['Quarter','Revenue'],rows:[['Q1',12],['Q2',18],['Q3',24]]}}}
    ]},
    {id:'details',title:'Keep content structured and editable',composition:{mode:'grid',columns:2},blocks:[
      {metric:{value:98,label:'Retention',unit:'%'}},
      {quote:{text:'Make the next step clear.',attribution:'Design team'}},
      {code:{source:'const slide = { title: "Hello" };',language:'javascript'}},
      {timeline:[{when:'Now',what:'Prototype'},{when:'Next',what:'Review'}]}
    ]},
  ],
};
// RR-22: autosave to this browser (IndexedDB, with localStorage as the fallback), a restore prompt for a stored copy that differs from the starting
// document, and a warning before the page closes with changes that were not saved as an OPF file. Nothing leaves the browser. A host page
// configures it with `globalThis.OPF_EDITOR_HOST = { persistence: { key, storage, onRestorePrompt } | false }` before this script runs, or a
// frame with `?persist=<key>` (`?persist=0` turns it off); the default key is shared by every copy of this editor on one origin.
const hostPersistence = (() => {
  const params = new URLSearchParams(globalThis.location?.search ?? '');
  const configured = globalThis.OPF_EDITOR_HOST?.persistence;
  if (configured === false || params.get('persist') === '0') return false;
  return { ...(configured && typeof configured === 'object' ? configured : {}), key: params.get('persist') || configured?.key || 'opf-editor-playground' };
})();
let editor, ed;
let selectedPath = 'slides.0.title', selectedValue, renderError, review, pendingContentFocus = false, keepInspectorPanel = false, pictureTools;
function status(message) { ed.status(message); }
// RR-06: every dimension switch, design option, content conversion, chart type and table style/merge is a control here. Each commits one
// undoable session change, so the editor's update loop (which redraws every part, and loads fonts first) runs after an edit exactly as for any change.
// The editor library mounts these parts in the page's own elements.
ed = createOpfEditor(document.body, {
  document: startDeck,
  catalogs,
  fonts,
  slots: {
    canvas: element('preview'), slide: document.querySelector('.canvas-scroll'), properties: element('canvas-properties'),
    navigator: element('slide-nav'), thumbnails: element('thumb-strip'),
    slides: element('slide-list'), slideToolbar: element('slide-toolbar'),
    sorter: element('sorter-list'), sorterView: element('sorter-view'), outline: element('outline-view'), layouts: element('layouts-view'),
    export: element('export-menu'), present: element('present-button'),
    status: element('status'), banner: element('restore-banner'), autosave: element('autosave-status'),
    overlay: document.body,
  },
  persistence: hostPersistence,
  export: { exportPptx: (deck, request) => pptxExporter({ editor, fonts, measurementFor: value => layoutFor(value, 0).fonts.textMeasurement })(deck, request) },
  // The page has its own Ctrl/Cmd+Z handler below (it reports through the status line).
  shortcuts: false,
  // The slide stays at its position when slides are added, removed or moved around it (an Undo of a duplicate, say), as it always has here.
  slideRetention: 'position',
  labels: { thumbnails: 'Slide thumbnails' },
});
editor = ed.session;
const designControls = createDesignControls(element('design-controls'), {editor, vocabularies: catalogDisplay, getSlideIndex: () => ed.slideIndex, getSelectedPath: () => selectedPath, sections: ['look', 'variant', 'background', 'header-footer', 'brand', 'layout-options', 'info', 'catalog']});
const selectionControls = createDesignControls(element('selection-controls'), {editor, vocabularies: catalogDisplay, getSlideIndex: () => ed.slideIndex, getSelectedPath: () => selectedPath, sections: ['selection', 'image', 'table', 'slide-content'], onSelectPath: path => select(path)});
// RR-24: "Edit data" opens the data grid for the selected chart or table over the bottom of the canvas (it never moves the slide), so edits show in the preview at once.
let dataGridOpen = false, dataGrid;
const syncDataGrid = () => {
  const target = dataGrid?.target;
  const open = dataGridOpen && Boolean(target);
  element('edit-data').hidden = !target;
  element('edit-data').setAttribute('aria-expanded', String(open));
  element('edit-data').textContent = open ? 'Hide data' : 'Edit data';
  element('data-grid-dock').hidden = !open;
};
dataGrid = createDataGrid(element('data-grid-host'), {editor, getSelectedPath: () => selectedPath, onTargetChange: () => syncDataGrid()});
syncDataGrid();
element('edit-data').onclick = () => { dataGridOpen = !dataGridOpen; syncDataGrid(); if (dataGridOpen) dataGrid.focus(); };
element('close-data-grid').onclick = () => { dataGridOpen = false; syncDataGrid(); element('edit-data').focus(); };
let activePanel = 'content';
function showPanel(panel, focus = false) {
  activePanel = panel;
  for (const name of ['content', 'design', 'review']) {
    const selected = name === panel;
    element(`tab-${name}`).setAttribute('aria-selected', String(selected));
    element(`tab-${name}`).tabIndex = selected ? 0 : -1;
    element(`panel-${name}`).hidden = !selected;
  }
  if (focus) element(`tab-${panel}`).focus();
}
function updateZoom() {
  const svg = element('preview').querySelector('svg');
  const zoom = element('zoom').value;
  const stage = document.querySelector('.canvas-stage');
  stage.style.width = zoom === 'fit' ? '100%' : `${(Number(svg?.getAttribute('width')) || 1280) * Number(zoom) / 100 + 68}px`;
}
// The source view keeps the exact bytes of source the author applied (escapes, spacing, key order)
// and rewrites only edited tokens, so Escape, Undo and Redo restore them. Without applied source
// it shows the normalized document.
let sourceText = null;
const sourceMemory = createSourceMemory();
// Repeated object keys cannot be edited faithfully (JSON.parse keeps only the last one).
function duplicateKeyMessage(source) {
  const duplicate = findDuplicateKey(source);
  return duplicate ? `Duplicate key "${duplicate.key}"${duplicate.path.length ? ` in ${duplicate.path.join('.')}` : ''}. Remove the repeated key before applying.` : '';
}
const prettySource = deck => JSON.stringify(deck, null, 2);
function viewSource(deck) {
  if (sourceText === null) return prettySource(deck);
  try {
    sourceText = updateJsonSource(sourceText, deck, sourceMemory);
    const note = sourceMemory.limited ? `Source is over ${MAX_EXACT_SOURCE_LENGTH.toLocaleString('en-US')} characters: edits still work, but Escape and Undo restore edited values in normalized JSON spelling.` : '';
    element('source-dialog').querySelector('.dialog-footer span').textContent = note || 'Validated before changes are applied.';
    if (note) status(note);
    return sourceText;
  }
  catch { sourceText = null; return prettySource(deck); }
}
// RR-21, RR-98: the slide navigator and the sorter share one component (slide-manager.js): select, drag and keyboard reorder, hide, sections,
// duplicate, delete, add with a layout, split and merge. The thumbnails come from the same cache, keyed by what a slide draws. The prev/next counter
// and the thumbnail strip follow the session on their own. All of it is mounted and kept current by the editor library (the slots above).
// Slide, Sorter, Outline and Layouts are views of the same document; the slide inspector follows whichever slide is current.
for (const view of ['slide', 'sorter', 'outline', 'layouts']) element(`view-${view}`).onclick = () => ed.setView(view, { focus: true });
ed.on('view', ({ view }) => {
  for (const name of ['slide', 'sorter', 'outline', 'layouts']) element(`view-${name}`).setAttribute('aria-pressed', String(name === view));
  document.querySelector('.editing-shell').dataset.view = view;
  document.querySelector('.canvas-column').dataset.view = view;
  for (const id of ['insert-content', 'arrange', 'zoom']) element(id).disabled = view !== 'slide';
});

function act(callback) {
  try { callback(); status(renderError ?? 'Changes saved in this session'); }
  catch (error) { status(error.issues?.[0]?.message ?? error.message); }
}
function select(path) {
  selectedPath = path;
  selectedValue = editor.get(path);
  element('path').textContent = path;
  const field = path.split('.').at(-1);
  const labels = {title:'Title',subtitle:'Subtitle',text:'Text',items:'List',bullets:'List',tag:'Tag'};
  element('selection-kind').textContent = labels[field] ?? 'Content';
  element('value-label').textContent = typeof selectedValue === 'string' ? 'Text content' : 'Content JSON';
  element('preview').querySelectorAll('g[data-opf-path]').forEach(node => node.classList.toggle('is-selected', node.getAttribute('data-opf-path') === path));
  element('value').value = typeof selectedValue === 'string' ? selectedValue : JSON.stringify(selectedValue, null, 2) ?? '';
  designControls.refresh(); selectionControls.refresh(); dataGrid.refresh(); pictureTools?.refresh();
}
// The page's own part of an update: the editor library emits `sync` after every document or slide change, once the faces the document needs are
// loaded, with the slide on show, its geometry and the layout notes (fonts substituted, overflow), computed when read.
function render({ presentation: deck, slideIndex, geometry, diagnostics }) {
  element('slide-count').textContent = deck.slides.length;
  element('slide-number').textContent = String(slideIndex + 1).padStart(2, '0');
  element('slide-title').textContent = deck.slides[slideIndex].title ?? 'Untitled slide';
  element('page-position').textContent = `Slide ${slideIndex + 1} of ${deck.slides.length}`;
  element('document-name').value = deck.name ?? 'Untitled presentation';
  element('notes').value = deck.slides[slideIndex].notes ?? '';
  element('undo').disabled = !editor.canUndo; element('redo').disabled = !editor.canRedo;
  // The accent font makes the font scheme an object ({id, accent}); the select shows its id.
  const scheme = deck.design?.fontScheme;
  element('font').value = (scheme && typeof scheme === 'object' ? scheme.id : scheme) ?? 'roboto';
  element('mode').value = deck.slides[slideIndex].composition?.mode ?? 'auto';
  const groupSelect = element('group');
  const previousGroup = groupSelect.value;
  groupSelect.replaceChildren(...geometry.groups.map(group => {
    const option = document.createElement('option'); option.value = group.path; option.textContent = group.path.replace(`slides.${slideIndex}.`, ''); return option;
  }));
  if ([...groupSelect.options].some(option => option.value === previousGroup)) groupSelect.value = previousGroup;
  element('group-controls').hidden = !groupSelect.options.length;
  element('group-mode').value = editor.get(`${groupSelect.value}.composition.mode`, 'auto');
  // A render that finishes while the source dialog is open (the starting deck's faces loading when a host hands a document over) must not
  // overwrite the source being edited or applied: Apply checks that the text is still what it parsed.
  if (!element('source-dialog').open) element('json').value = viewSource(deck);
  element('diagnostics').replaceChildren(...diagnostics.map(issue => { const item = document.createElement('li'); item.textContent = issue.message; item.title = issue.path; return item; }));
  element('diagnostics-section').hidden = diagnostics.length === 0;
  element('diagnostic-count').textContent = diagnostics.length;
  updateZoom();
  // A cell of a chart or table that an insert, delete, move or sort made vanish keeps its chart or table selected (RR-24), so the data grid stays open.
  if (selectedPath.startsWith(`slides.${slideIndex}.`) && editor.get(selectedPath) === undefined) { const owner = /^(.*[.](?:table|chart))[.]/.exec(selectedPath)?.[1]; if (owner && editor.get(owner) !== undefined) selectedPath = owner; }
  if (!selectedPath.startsWith(`slides.${slideIndex}.`) || editor.get(selectedPath) === undefined) selectedPath = `slides.${slideIndex}.title`;
  select(selectedPath);
  review?.schedule();
  if (pendingContentFocus) { pendingContentFocus = false; showPanel('content'); element('value').focus(); }
}
ed.on('sync', render);
// Undo and Redo follow the session also while the fonts of a new document load or fail to load.
ed.on('fonts', () => { element('undo').disabled = !editor.canUndo; element('redo').disabled = !editor.canRedo; });
ed.on('error', ({ error }) => { renderError = error.message; status(error.message); });
ed.on('render', () => { renderError = undefined; });
// An inline edit in the canvas shows in the JSON as it is typed, without touching the session.
ed.on('selection', ({ path }) => { select(path); if (!keepInspectorPanel) showPanel('content'); });
ed.on('draft', ({ presentation }) => { element('json').value = viewSource(presentation); status('Editing on the slide · Esc to cancel'); });
ed.on('commit', () => status('Changes saved in this session'));
ed.on('cancel', () => { element('json').value = viewSource(editor.presentation); status('Edit cancelled'); });
ed.on('export', ({ fileName }) => status(`${fileName} downloaded · Save OPF to keep your original editable source`));
element('apply').onclick = () => act(() => editor.set(selectedPath, typeof selectedValue === 'string' ? element('value').value : JSON.parse(element('value').value)));
element('undo').onclick = () => act(() => ed.undo());
element('redo').onclick = () => act(() => ed.redo());
// Keep an object-form font scheme's overrides (the accent font) when only the base scheme changes.
element('font').onchange = () => act(() => editor.set(editor.get('design.fontScheme') && typeof editor.get('design.fontScheme') === 'object' ? 'design.fontScheme.id' : 'design.fontScheme', element('font').value));
element('insert-content').onclick = () => ed.canvas?.openInsertMenu();
element('arrange').onclick = () => {
  const canvas = ed.canvas;
  if (canvas?.setLayoutEditing(!canvas.layoutEditing)) {
    element('arrange').setAttribute('aria-pressed', String(canvas.layoutEditing));
    status(canvas.layoutEditing ? 'Drag dividers to resize and numbered handles to reorder. Click a handle to move, duplicate, delete or add content.' : 'Layout handles hidden');
  }
};
element('mode').onchange = () => act(() => editor.setComposition(ed.slideIndex, { ...editor.get(`slides.${ed.slideIndex}.composition`, {}), mode: element('mode').value }));
element('group').onchange = () => { element('group-mode').value = editor.get(`${element('group').value}.composition.mode`, 'auto'); };
element('group-mode').onchange = () => act(() => editor.setGroupComposition(element('group').value, { ...editor.get(`${element('group').value}.composition`, {}), mode: element('group-mode').value }));
element('paginate').onclick = () => act(() => editor.paginateSlide(ed.slideIndex,layoutFor(editor.presentation,ed.slideIndex)));
element('add').onclick = () => act(() => {
  const deck = editor.presentation;
  let index = deck.slides.length + 1;
  while (deck.slides.some(slide => slide.id === `slide-${index}`)) index++;
  const added = deck.slides.length;
  editor.applyPatch([{ op: 'add', path: '/slides/-', value: { id: `slide-${index}`, title: 'New slide', text: 'Write your next idea here.' } }]);
  ed.setSlide(added);
});
element('add-layout').onclick = () => ed.slideManager.openLayoutPicker();
element('choose-layout').onclick = () => ed.slideManager.openLayoutPicker('apply');
element('custom-layout').onclick = () => { if (ed.setView('layouts', { focus: true })) { ed.layoutStudio.pick.value = ''; ed.layoutStudio.load(''); } };
let applying = false;
// Also the gallery handoff: it fills #json and clicks this button in the same tick, without waiting for the source preview.
element('apply-json').onclick = async event => {
  if (applying) return;
  const applied = element('json').value;
  let deck;
  try {
    deck = JSON.parse(applied);
    const duplicate = duplicateKeyMessage(applied);
    if (duplicate) { element('json-error').textContent = duplicate; return; }
  } catch(error) { element('json-error').textContent = error.issues?.[0]?.message ?? error.message; return; }
  // The faces the source needs load before it becomes the document, so the canvas, the thumbnails and the layout never see it early.
  if (pendingFonts(deck).length) {
    applying = true;
    element('json-error').textContent = 'Loading fonts for this document…';
    try { await fonts.ensure(deck, renderOptions()); }
    catch (error) { element('json-error').textContent = error.message; return; }
    finally { applying = false; }
    if (!element('source-dialog').open || element('json').value !== applied) return;
    element('json-error').textContent = '';
  }
  const prior = sourceText;
  try {
    // Remember the spelling of the document being replaced so Undo restores it exactly, then keep the applied bytes.
    updateJsonSource(sourceText ?? prettySource(editor.presentation), editor.presentation, sourceMemory);
    sourceText = applied;
    // A host that loads a document (the gallery handoff) opens it: no catalog record of the current deck is forked (RR-98). Typed source is an edit.
    if (event?.isTrusted === false) editor.replaceDocument(deck, { source: 'load' });
    else editor.applyPatch([{op:'replace',path:'',value:deck}]);
    // A host that loads a document (the gallery handoff clicks this button from script) is not the user's work: do not autosave it or warn about it.
    if (event?.isTrusted === false) ed.persistence?.rebase();
    if (renderError) { element('json-error').textContent = renderError; return; }
    element('source-dialog').close(); status('Presentation source updated');
  } catch(error) { sourceText = prior; element('json-error').textContent = error.issues?.[0]?.message ?? error.message; }
};
element('open-json').onclick = () => { if(!ed.commit())return; element('json').value = viewSource(editor.presentation); element('json-error').textContent = ''; element('source-dialog').showModal();previewSource(); };
element('close-json').onclick = () => element('source-dialog').close();
let sourceFrame=0,previewToken=0;
function previewSource() {
  const token=++previewToken,fail=error=>{element('json-error').textContent=error.issues?.[0]?.message ?? error.message;element('apply-json').disabled=true;};
  let deck;
  try {
    deck=JSON.parse(element('json').value);
    const duplicate=duplicateKeyMessage(element('json').value);
    if(duplicate)throw new Error(duplicate);
  } catch(error) {fail(error);return;}
  whenFontsReady(fonts,deck,{
    renderOptions:renderOptions(),
    isCurrent:()=>token===previewToken,
    // Apply stays enabled while the preview's faces load: it loads what the source needs itself before applying it, and a host that
    // clicks it the moment the page is ready (the gallery handoff) must not hit a disabled button because the starting deck's faces are still loading.
    loading:()=>{element('json-error').textContent='Loading fonts for this document…';},
    ready:()=>{
      const svg=toSvg(deck,Math.min(ed.slideIndex+1,deck.slides?.length ?? 1),{...renderOptions(),fonts,text:'system'});
      element('source-preview').innerHTML=svg;element('json-error').textContent='';element('apply-json').disabled=false;
    },
    failed:fail,
  });
}
element('json').addEventListener('input',()=>{cancelAnimationFrame(sourceFrame);sourceFrame=requestAnimationFrame(previewSource);});

const inspectorPanels = ['content','design','review'];
for (const panel of inspectorPanels) {
  element(`tab-${panel}`).onclick = () => showPanel(panel);
  element(`tab-${panel}`).onkeydown = event => {
    if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) { event.preventDefault(); const visible = inspectorPanels.filter(name => !element(`tab-${name}`).hidden), at = visible.indexOf(activePanel); showPanel(event.key==='Home' ? visible[0] : event.key==='End' ? visible.at(-1) : visible[(at + (event.key==='ArrowRight' ? 1 : -1) + visible.length) % visible.length],true); }
  };
}
element('zoom').onchange = updateZoom;
element('document-name').onchange = () => act(() => editor.set('name',element('document-name').value.trim() || 'Untitled presentation'));
element('document-name').onkeydown = event => { if(event.key==='Enter') event.currentTarget.blur(); };
element('apply-notes').onclick = () => act(() => editor.set(`slides.${ed.slideIndex}.notes`,element('notes').value));
element('download').onclick = () => {
  if(!ed.commit())return;
  // Saving embeds every catalog record the deck uses (core embed), so the file renders the same where no catalog is registered.
  const deck=saveDocument(editor).document, blob=new Blob([JSON.stringify(deck,null,2)],{type:'application/json'}), url=URL.createObjectURL(blob);
  const link=document.createElement('a'); link.href=url; link.download=`${(deck.name ?? 'presentation').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'') || 'presentation'}.opf.json`;
  link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); status('OPF file downloaded');
  ed.persistence?.markSaved();
};
document.addEventListener('keydown',event=>{
  if (!(event.metaKey || event.ctrlKey)) return;
  if (event.key==='Enter' && document.activeElement===element('value')) { event.preventDefault(); element('apply').click(); return; }
  if (event.key.toLowerCase()==='z' && !event.target.closest('input,textarea,[contenteditable]') && !element('source-dialog').open) {
    event.preventDefault(); act(()=>event.shiftKey ? ed.redo() : ed.undo());
  }
});

const galleryConfig=await fetch('./galleries.json').then(response=>{if(!response.ok)throw new Error('Gallery configuration unavailable');return response.json();}).catch(()=>[{name:'PPTX.gallery',url:'https://www.pptx.gallery/registry.json'}]);
installTransferControls({editor,getCanvas:()=>ed.canvas,getSlideIndex:()=>ed.slideIndex,getSelectedPath:()=>selectedPath,setSlideIndex:value=>{ed.setSlide(value);},status,galleries:galleryConfig,fonts});

let propertiesInspector,propertiesPreviewToken=0;
const propertiesDialog=element('properties-dialog');
element('open-properties').onclick=()=>{
 if(!ed.commit())return;
 propertiesDialog.showModal();
 propertiesInspector?.destroy();
 propertiesInspector=createSchemaInspector(element('schema-properties'),{editor,path:`/slides/${ed.slideIndex}`,
  onDraft:({presentation:deck})=>{const token=++propertiesPreviewToken;whenFontsReady(fonts,deck,{renderOptions:renderOptions(),isCurrent:()=>token===propertiesPreviewToken,loading:()=>{element('properties-preview-status').textContent='Loading fonts for this document…';},ready:()=>{element('properties-preview').innerHTML=toSvg(deck,Math.min(ed.slideIndex+1,deck.slides.length),{...renderOptions(),fonts,text:'system',trace:true});element('properties-preview-status').textContent='Click slide content to find its field. Metadata is stored with the deck.';},failed:error=>{element('properties-preview-status').textContent='Preview unavailable: '+error.message;}});},
  onCommit:()=>status('Presentation properties updated'),onError:error=>status(error.message)
 });
};
function closeProperties(){if(propertiesInspector?.dirty){element('properties-preview-status').textContent='Apply changes or Discard draft before closing.';return;}propertiesDialog.close();propertiesInspector?.destroy();propertiesInspector=undefined;}
element('close-properties').onclick=closeProperties;
propertiesDialog.addEventListener('cancel',event=>{event.preventDefault();closeProperties();});
for(const [id,path]of [['deck',''],['slide',()=>`/slides/${ed.slideIndex}`],['selection',()=>selectedPath],['design','/design'],['assets','/assets'],['catalogs','/catalogs']])element('properties-'+id).onclick=()=>{
 const target=typeof path==='function'?path():path;
 propertiesInspector?.navigate(target);
};
element('properties-preview').onclick=event=>{const target=event.target.closest('[data-opf-path]');if(target)propertiesInspector?.navigate(target.getAttribute('data-opf-path'));};

installDataControls({editor,getCanvas:()=>ed.canvas,getSlideIndex:()=>ed.slideIndex,getSelectedPath:()=>selectedPath,setSlideIndex:value=>{ed.setSlide(value);},status,fonts});
pictureTools=installCropControls({editor,getCanvas:()=>ed.canvas,getSelectedPath:()=>selectedPath,getSlideIndex:()=>ed.slideIndex,status});
installFindControls({editor,getCanvas:()=>ed.canvas,getSlideIndex:()=>ed.slideIndex,goToSlide:index=>{if(index===ed.slideIndex)return;ed.setSlide(index);return ed.whenIdle();},status,showPanel});
installMobileControls();
installTemplateControls({editor,getCanvas:()=>ed.canvas,getSlideIndex:()=>ed.slideIndex,getSelectedPath:()=>selectedPath,setSlideIndex:value=>{ed.setSlide(value);},status,fonts});
// RR-29: the Review tab. A finding's go-to selects the slide and the content; the panel re-checks after every redraw (render()).
const openPropertiesAt = pointer => { element('open-properties').click(); propertiesInspector?.navigate(pointer); };
review = installReviewControls({editor,getSlideIndex:()=>ed.slideIndex,goTo:(index,path)=>{keepInspectorPanel=true;try{ed.goTo(index,path);}finally{keepInspectorPanel=false;}selectedPath=path;select(path);},openProperties:openPropertiesAt,focusContentField:()=>{pendingContentFocus=true;ed.refresh();},status,measurementFor:(deck,index)=>layoutFor(deck,index).fonts.textMeasurement});
review?.refresh();
installChartControls({editor,getSelectedPath:()=>selectedPath,status});
installNumberingControls({editor,getCanvas:()=>ed.canvas,getSlideIndex:()=>ed.slideIndex,getSelectedPath:()=>selectedPath,status});
