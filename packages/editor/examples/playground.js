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
import { createEditorSession, saveDocument } from '../src/index.js';
// FA-23: the editor library ships no catalog data. This app is the host: it registers the default catalog (the pptx.gallery
// snapshot core publishes as an opt-in subpath) and hands the session's one list to every render, check, embed and export.
import { catalogDisplay, defaultCatalog } from '@openpresentation/opf/catalog';
import {createCanvasEditor} from '../src/canvas.js';
import { whenFontsReady } from '../src/font-gate.js';
import * as browserFonts from '@openpresentation/opf-render/fonts-browser';
import { toSvg } from '@openpresentation/opf-render/svg';
import * as renderFontCore from '@openpresentation/opf-render/fonts';
import { resolveScriptFonts } from '@openpresentation/opf/composition';
import { installPptxExport } from './pptx-controls.js';
import { installDownloadControls } from './download-controls.js';
import { createDesignControls } from '../src/design-controls.js';
import { createPersistence } from '../src/persistence.js';
import { createPersistenceUi } from '../src/persistence-ui.js';
import { createSlideManager } from '../src/slide-manager.js';
import { createOutlineView } from '../src/outline-view.js';
import { splitSlideByBlocks, mergeSlides } from '../src/content-actions.js';
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
// FF-41: nothing renders or measures a document before this gate has loaded the faces it needs. Every path that sets a new
// document or draws a slide (initial load, Source Apply and the gallery handoff, import, undo and redo, font and language
// switches, slide navigation, thumbnails, previews and export) goes through whenFontsReady(fonts, ...) or the canvas's own gate.
// The faces a document needs that are not loaded yet; a document the renderer cannot resolve reports none and fails when it renders.
const catalogs = [defaultCatalog];
const renderOptions = () => ({ catalogs: editor.catalogs });
const pendingFonts = deck => { try { return fonts.pending(deck, renderOptions()); } catch { return []; } };
// toSvg measures each script with its own face and falls back per glyph (Japanese under Aptos draws with Noto Sans JP where
// Intos Display has no glyph), but the session's composeSlide and paginateSlide take the handle's plain measurement, and that one is strict:
// it throws "Font 'Intos Display' cannot display U+65E5" even with every face loaded. Give them the same per-document, script-aware
// measurement (opf-render README: createScriptTextMeasurement(registry.textMeasurement, resolveScriptFonts(presentation))).
const layoutFor = (deck,index) => {
  try { return {fonts:{textMeasurement:renderFontCore.createScriptTextMeasurement(fonts.textMeasurement,resolveScriptFonts(deck,{slideIndex:index,catalogs:editor.catalogs}))}}; }
  catch { return {fonts}; }
};
const editor = createEditorSession({
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
}, { rejectInvalid: true, catalogs });
const element = id => document.getElementById(id);
let slideIndex = 0, selectedPath = 'slides.0.title', selectedValue, canvas, renderError, fontsFailure, review, pendingContentFocus = false, pictureTools;
// RR-06: every dimension switch, design option, content conversion, chart type and table style/merge is a control here. Each commits one
// undoable session change, so the editor.subscribe(refresh) below redraws the preview (and loads fonts first) exactly as for an edit.
const designControls = createDesignControls(element('design-controls'), {editor, vocabularies: catalogDisplay, getSlideIndex: () => slideIndex, getSelectedPath: () => selectedPath, sections: ['look', 'background', 'header-footer', 'brand', 'layout-options', 'info', 'catalog']});
const selectionControls = createDesignControls(element('selection-controls'), {editor, vocabularies: catalogDisplay, getSlideIndex: () => slideIndex, getSelectedPath: () => selectedPath, sections: ['selection', 'image', 'table', 'slide-content'], onSelectPath: path => select(path)});
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
function status(message) { element('status').textContent = message; }
let activePanel = 'content';
const thumbnailCache = new Map();
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
// RR-21: the slide navigator and the sorter share one component (slide-manager.js): select, drag and keyboard reorder, hide, sections,
// duplicate, delete, add with a layout, split and merge. The thumbnails come from the same cache, keyed by what a slide draws.
const thumbnailKey = (deck, index) => JSON.stringify([index, deck.slides.length, deck.slides[index], deck.design, deck.catalogs, deck.assets]);
function thumbnailHtml(deck, index) {
  const key = thumbnailKey(deck, index);
  if (!thumbnailCache.has(key)) {
    try { thumbnailCache.set(key, toSvg(deck, index + 1, {...renderOptions(), fonts, text: 'system', trace: false})); }
    catch { thumbnailCache.set(key, 'Preview unavailable'); }
  }
  return thumbnailCache.get(key);
}
const slideManagerOptions = {
  editor, getSlideIndex: () => slideIndex, setSlideIndex: value => { slideIndex = value; refresh(); },
  renderThumbnail: thumbnailHtml, onStatus: message => status(message), onError: () => {}, autoRender: false,
  // RR-26: split a slide by its blocks and merge slides, from the slide menu.
  contentActions: { splitSlideByBlocks, mergeSlides },
};
const slideManager = createSlideManager(element('slide-list'), {...slideManagerOptions, toolbar: element('slide-toolbar')});
let sorter, outline, activeView = 'slide';
function renderNavigator(deck) {
  element('slide-count').textContent = deck.slides.length;
  slideManager.render();
  if (activeView === 'sorter') sorter.render();
  if (activeView === 'outline') outline.render();
  const live = new Set(deck.slides.map((_, index) => thumbnailKey(deck, index)));
  for (const key of thumbnailCache.keys()) if (!live.has(key)) thumbnailCache.delete(key);
}
// Slide, Sorter and Outline are views of the same document; the slide inspector follows whichever slide is current.
function showView(view, focus = false) {
  if (view !== 'slide' && canvas && !canvas.commit()) return;
  activeView = view;
  if (view === 'sorter' && !sorter) sorter = createSlideManager(element('sorter-list'), {...slideManagerOptions, variant: 'sorter'});
  if (view === 'outline' && !outline) outline = createOutlineView(element('outline-view'), {editor, onSelectSlide: index => { if (index !== slideIndex) { slideIndex = index; refresh(); } }, getSlideIndex: () => slideIndex, onStatus: message => status(message)});
  for (const name of ['slide', 'sorter', 'outline']) element(`view-${name}`).setAttribute('aria-pressed', String(name === view));
  document.querySelector('.canvas-scroll').hidden = view !== 'slide';
  element('sorter-view').hidden = view !== 'sorter';
  element('outline-view').hidden = view !== 'outline';
  document.querySelector('.canvas-column').dataset.view = view;
  for (const id of ['insert-content', 'arrange', 'zoom']) element(id).disabled = view !== 'slide';
  if (view === 'sorter') { sorter.render(); if (focus) sorter.focus(slideIndex); }
  if (view === 'outline') { outline.render(); if (focus) outline.focusSlide(slideIndex); }
  if (view === 'slide' && canvas) canvas.setSlide(slideIndex);
  status(view === 'slide' ? 'Slide view' : view === 'sorter' ? 'Slide sorter: drag slides, or use Alt and the arrow keys, to reorder' : 'Outline: edit titles and text as an outline');
}
for (const view of ['slide', 'sorter', 'outline']) element(`view-${view}`).onclick = () => showView(view, true);

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
// Review text for one font resolution the registry recorded. A change inside one family is a style fallback (the weight or italic asked
// for is not held, so the nearest face of the same family is drawn), not a replacement font: name the styles, never "Roboto → Roboto".
function describeFontChange(change) {
  const sameFamily = (change.sourceFamily ?? change.requestedFamily).toLowerCase() === change.resolvedFamily.toLowerCase();
  if (!sameFamily) return `${change.requestedFamily} → ${change.resolvedFamily} · ${change.compatibility === 'metric' ? 'Metric substitute' : 'Approximate substitute; wrapping may change'} (${change.resolvedWeight}).`;
  const drawn = `${change.resolvedFamily} ${change.resolvedWeight}${change.italic ? ' italic' : ''}`;
  return change.requestedWeight === change.resolvedWeight
    ? `${change.requestedFamily}: the ${change.italic ? 'italic' : 'upright'} face asked for is not available, so ${drawn} is drawn; wrapping may change.`
    : `${change.requestedFamily} ${change.requestedWeight}: that weight is not available, so ${drawn} is drawn; wrapping may change.`;
}
function render() {
  fontRegistry.clearSubstitutions();
  renderError = undefined;
  const deck = editor.presentation;
  slideIndex = Math.max(0, Math.min(slideIndex, deck.slides.length - 1));
  renderNavigator(deck);
  fontRegistry.clearSubstitutions();
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
  const geometry = editor.composeSlide(slideIndex,layoutFor(deck,slideIndex));
  groupSelect.replaceChildren(...geometry.groups.map(group => {
    const option = document.createElement('option'); option.value = group.path; option.textContent = group.path.replace(`slides.${slideIndex}.`, ''); return option;
  }));
  if ([...groupSelect.options].some(option => option.value === previousGroup)) groupSelect.value = previousGroup;
  element('group-controls').hidden = !groupSelect.options.length;
  element('group-mode').value = editor.get(`${groupSelect.value}.composition.mode`, 'auto');
  element('undo').disabled = !editor.canUndo; element('redo').disabled = !editor.canRedo;
  // A render that finishes while the source dialog is open (the starting deck's faces loading when a host hands a document over) must not
  // overwrite the source being edited or applied: Apply checks that the text is still what it parsed.
  if (!element('source-dialog').open) element('json').value = viewSource(deck);
  const diagnostics = [];
  if (!canvas) canvas=createCanvasEditor(element('preview'),{
    editor,slideIndex,propertiesContainer:element('canvas-properties'),fonts,
    onFonts:event=>{
      if(event.state==='loading')status('Loading fonts…');
      else if(event.state==='error'){fontsFailure=event.error;status(event.error.message);}
      // The canvas drew a document after a failed load (its Retry button): bring the rest of the page up to date too.
      else if(fontsFailure){fontsFailure=undefined;refresh();}
    },
    onSelect:value=>{select(value.path);showPanel('content');},
    onDraft:value=>{element('json').value=viewSource(value.presentation);status('Editing on the slide · Esc to cancel');},
    onCommit:()=>status('Changes saved in this session'),
    onCancel:()=>{element('json').value=viewSource(editor.presentation);status('Edit cancelled');},
    onError:error=>status(error.message),
  });
  else canvas.setSlide(slideIndex);
  diagnostics.push(...geometry.diagnostics);
  diagnostics.push(...fonts.substitutions.filter((change,index,all)=>all.findIndex(other=>other.requestedFamily===change.requestedFamily && other.requestedWeight===change.requestedWeight && other.italic===change.italic)===index).map(change=>({path:change.path ?? 'design.fontScheme',message:describeFontChange(change)})));
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
function renderSafely() { try { render(); } catch (error) { renderError = error.message; canvas?.destroy(); canvas=undefined; element('preview').textContent = 'Preview unavailable for this document. Use Undo or revise the JSON.'; status(renderError); } }
let refreshToken = 0;
// The one "ensure fonts, then render" path for the page: initial load, every document change (Source Apply and the gallery
// handoff, import, undo and redo, font and language switches, edits), slide navigation and thumbnails. The document renders at
// once when the faces it needs are loaded; otherwise "Loading fonts…" shows, the faces load, and only then it renders. A document
// whose faces cannot be loaded is not rendered (not even to an error): the failure is reported and nothing retries by itself.
// The canvas gates its own renders with the same fonts handle, so it cannot draw ahead of this.
function refresh() {
  const token = ++refreshToken;
  let loaded = false;
  return whenFontsReady(fonts, editor.presentation, {
    renderOptions: renderOptions(),
    isCurrent: () => token === refreshToken,
    loading: () => { loaded = true; status('Loading fonts…'); if (!canvas) element('preview').textContent = 'Loading fonts…'; element('undo').disabled = !editor.canUndo; element('redo').disabled = !editor.canRedo; },
    ready: () => { fontsFailure = undefined; if (loaded) { thumbnailCache.clear(); if (/Loading fonts/.test(element('status').textContent)) status('Ready to edit'); } renderSafely(); },
    failed: error => { fontsFailure = error; status(error.message); element('undo').disabled = !editor.canUndo; element('redo').disabled = !editor.canRedo; if (!canvas) element('preview').textContent = error.message; },
  });
}
editor.subscribe(refresh);
// FA-23: an edit of a catalog's record (in Source, Properties or a panel) forks it into this deck's own records; tell the user.
editor.subscribe(event => { if (event.meta?.notice) setTimeout(() => status(event.meta.notice)); });
element('apply').onclick = () => act(() => editor.set(selectedPath, typeof selectedValue === 'string' ? element('value').value : JSON.parse(element('value').value)));
element('undo').onclick = () => act(() => editor.undo());
element('redo').onclick = () => act(() => editor.redo());
// Keep an object-form font scheme's overrides (the accent font) when only the base scheme changes.
element('font').onchange = () => act(() => editor.set(editor.get('design.fontScheme') && typeof editor.get('design.fontScheme') === 'object' ? 'design.fontScheme.id' : 'design.fontScheme', element('font').value));
element('insert-content').onclick = () => canvas?.openInsertMenu();
element('arrange').onclick = () => {
  if (canvas?.setLayoutEditing(!canvas.layoutEditing)) {
    element('arrange').setAttribute('aria-pressed', String(canvas.layoutEditing));
    status(canvas.layoutEditing ? 'Drag dividers to resize and numbered handles to reorder. Click a handle to move, duplicate, delete or add content.' : 'Layout handles hidden');
  }
};
element('mode').onchange = () => act(() => editor.setComposition(slideIndex, { ...editor.get(`slides.${slideIndex}.composition`, {}), mode: element('mode').value }));
element('group').onchange = () => { element('group-mode').value = editor.get(`${element('group').value}.composition.mode`, 'auto'); };
element('group-mode').onchange = () => act(() => editor.setGroupComposition(element('group').value, { ...editor.get(`${element('group').value}.composition`, {}), mode: element('group-mode').value }));
element('paginate').onclick = () => act(() => editor.paginateSlide(slideIndex,layoutFor(editor.presentation,slideIndex)));
element('add').onclick = () => act(() => {
  const deck = editor.presentation;
  let index = deck.slides.length + 1;
  while (deck.slides.some(slide => slide.id === `slide-${index}`)) index++;
  slideIndex = deck.slides.length;
  editor.applyPatch([{ op: 'add', path: '/slides/-', value: { id: `slide-${index}`, title: 'New slide', text: 'Write your next idea here.' } }]);
});
element('add-layout').onclick = () => slideManager.openLayoutPicker();
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
    editor.applyPatch([{op:'replace',path:'',value:deck}]);
    // A host that loads a document (the gallery handoff clicks this button from script) is not the user's work: do not autosave it or warn about it.
    if (event?.isTrusted === false) persistence?.rebase();
    if (renderError) { element('json-error').textContent = renderError; return; }
    element('source-dialog').close(); status('Presentation source updated');
  } catch(error) { sourceText = prior; element('json-error').textContent = error.issues?.[0]?.message ?? error.message; }
};
element('open-json').onclick = () => { if(canvas && !canvas.commit())return; element('json').value = viewSource(editor.presentation); element('json-error').textContent = ''; element('source-dialog').showModal();previewSource(); };
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
      const svg=toSvg(deck,Math.min(slideIndex+1,deck.slides?.length ?? 1),{...renderOptions(),fonts,text:'system'});
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
element('apply-notes').onclick = () => act(() => editor.set(`slides.${slideIndex}.notes`,element('notes').value));
element('download').onclick = () => {
  if(canvas && !canvas.commit())return;
  // Saving embeds every catalog record the deck uses (core embed), so the file renders the same where no catalog is registered.
  const deck=saveDocument(editor).document, blob=new Blob([JSON.stringify(deck,null,2)],{type:'application/json'}), url=URL.createObjectURL(blob);
  const link=document.createElement('a'); link.href=url; link.download=`${(deck.name ?? 'presentation').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'') || 'presentation'}.opf.json`;
  link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); status('OPF file downloaded');
  persistence?.markSaved();
};
document.addEventListener('keydown',event=>{
  if (!(event.metaKey || event.ctrlKey)) return;
  if (event.key==='Enter' && document.activeElement===element('value')) { event.preventDefault(); element('apply').click(); return; }
  if (event.key.toLowerCase()==='z' && !event.target.closest('input,textarea,[contenteditable]') && !element('source-dialog').open) {
    event.preventDefault(); act(()=>event.shiftKey ? editor.redo() : editor.undo());
  }
});
refresh();

// RR-22: autosave to this browser (IndexedDB, with localStorage as the fallback), a restore prompt for a stored copy that differs from the starting
// document, and a warning before the page closes with changes that were not saved as an OPF file. Nothing leaves the browser. A host page
// configures it with `globalThis.OPF_EDITOR_HOST = { persistence: { key, storage, onRestorePrompt } | false }` before this script runs, or a
// frame with `?persist=<key>` (`?persist=0` turns it off); the default key is shared by every copy of this editor on one origin.
const hostPersistence = (() => {
  const params = new URLSearchParams(globalThis.location?.search ?? '');
  const configured = globalThis.OPF_EDITOR_HOST?.persistence;
  if (configured === false || params.get('persist') === '0') return null;
  return { ...(configured && typeof configured === 'object' ? configured : {}), key: params.get('persist') || configured?.key || 'opf-editor-playground' };
})();
let persistence;
if (hostPersistence) {
  const persistenceUi = createPersistenceUi({ banner: element('restore-banner'), indicator: element('autosave-status'), restoreEarlier: () => persistence.restoreEarlier(), suffix: 'Save an OPF file to keep a copy.', fallback: 'Changes stay in this session.\nSave an OPF file to keep your work.' });
  persistence = createPersistence(editor, { ...hostPersistence, onRestorePrompt: hostPersistence.onRestorePrompt ?? persistenceUi.prompt, onStatus: status => { persistenceUi.status(status); hostPersistence.onStatus?.(status); }, beforeFlush: () => { canvas?.commit(); } });
}

const galleryConfig=await fetch('./galleries.json').then(response=>{if(!response.ok)throw new Error('Gallery configuration unavailable');return response.json();}).catch(()=>[{name:'PPTX.gallery',url:'https://www.pptx.gallery/registry.json'}]);
installTransferControls({editor,getCanvas:()=>canvas,getSlideIndex:()=>slideIndex,getSelectedPath:()=>selectedPath,setSlideIndex:value=>{slideIndex=value;},status,galleries:galleryConfig,fonts});
installPptxExport({editor,getCanvas:()=>canvas,status,fonts,measurementFor:deck=>layoutFor(deck,0).fonts.textMeasurement});
// RR-23: PDF, PNG and SVG downloads from the same drawing as the preview, with the faces the registry holds.
installDownloadControls({editor,getCanvas:()=>canvas,getSlideIndex:()=>slideIndex,status,fonts});

let propertiesInspector,propertiesPreviewToken=0;
const propertiesDialog=element('properties-dialog');
element('open-properties').onclick=()=>{
 if(canvas&&!canvas.commit())return;
 propertiesDialog.showModal();
 propertiesInspector?.destroy();
 propertiesInspector=createSchemaInspector(element('schema-properties'),{editor,path:`/slides/${slideIndex}`,
  onDraft:({presentation:deck})=>{const token=++propertiesPreviewToken;whenFontsReady(fonts,deck,{renderOptions:renderOptions(),isCurrent:()=>token===propertiesPreviewToken,loading:()=>{element('properties-preview-status').textContent='Loading fonts for this document…';},ready:()=>{element('properties-preview').innerHTML=toSvg(deck,Math.min(slideIndex+1,deck.slides.length),{...renderOptions(),fonts,text:'system',trace:true});element('properties-preview-status').textContent='Click slide content to find its field. Metadata is stored with the deck.';},failed:error=>{element('properties-preview-status').textContent='Preview unavailable: '+error.message;}});},
  onCommit:()=>status('Presentation properties updated'),onError:error=>status(error.message)
 });
};
function closeProperties(){if(propertiesInspector?.dirty){element('properties-preview-status').textContent='Apply changes or Discard draft before closing.';return;}propertiesDialog.close();propertiesInspector?.destroy();propertiesInspector=undefined;}
element('close-properties').onclick=closeProperties;
propertiesDialog.addEventListener('cancel',event=>{event.preventDefault();closeProperties();});
for(const [id,path]of [['deck',''],['slide',()=>`/slides/${slideIndex}`],['selection',()=>selectedPath],['design','/design'],['assets','/assets'],['catalogs','/catalogs']])element('properties-'+id).onclick=()=>{
 const target=typeof path==='function'?path():path;
 propertiesInspector?.navigate(target);
};
element('properties-preview').onclick=event=>{const target=event.target.closest('[data-opf-path]');if(target)propertiesInspector?.navigate(target.getAttribute('data-opf-path'));};

installDataControls({editor,getCanvas:()=>canvas,getSlideIndex:()=>slideIndex,getSelectedPath:()=>selectedPath,setSlideIndex:value=>{slideIndex=value;},status,fonts});
pictureTools=installCropControls({editor,getCanvas:()=>canvas,getSelectedPath:()=>selectedPath,getSlideIndex:()=>slideIndex,status});
installFindControls({editor,getCanvas:()=>canvas,getSlideIndex:()=>slideIndex,goToSlide:index=>{if(index===slideIndex)return;slideIndex=index;return refresh();},status,showPanel});
installMobileControls();
installTemplateControls({editor,getCanvas:()=>canvas,getSlideIndex:()=>slideIndex,getSelectedPath:()=>selectedPath,setSlideIndex:value=>{slideIndex=value;},status,fonts});
// RR-29: the Review tab. A finding's go-to selects the slide and the content; the panel re-checks after every redraw (render()).
const openPropertiesAt = pointer => { element('open-properties').click(); propertiesInspector?.navigate(pointer); };
review = installReviewControls({editor,getSlideIndex:()=>slideIndex,goTo:(index,path)=>{slideIndex=index;selectedPath=path;refresh();},openProperties:openPropertiesAt,focusContentField:()=>{pendingContentFocus=true;refresh();},status,measurementFor:(deck,index)=>layoutFor(deck,index).fonts.textMeasurement});
review?.refresh();
installChartControls({editor,getSelectedPath:()=>selectedPath,status});
installNumberingControls({editor,getCanvas:()=>canvas,getSlideIndex:()=>slideIndex,getSelectedPath:()=>selectedPath,status});
