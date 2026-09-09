import {installDataControls} from './data-controls.js';
import {createSchemaInspector} from '../src/schema-inspector.js';
import {installTransferControls} from './transfer-controls.js';
import { createEditorSession } from '../src/index.js';
import {createCanvasEditor} from '../src/canvas.js';
import {loadBrowserFontRegistry} from '@openpresentation/opf-render/fonts-browser';
import { renderSvg } from '@openpresentation/opf-render/svg';
import { installPptxExport } from './pptx-controls.js';

const fontFaces = await fetch('./fonts.json').then(response => {
  if (!response.ok) throw new Error('Bundled fonts are unavailable. Rebuild the editor demo.');
  return response.json();
});
const fontRegistry = await loadBrowserFontRegistry(fontFaces.map(face=>({family:face.family,weight:face.weight,italic:face.italic,license:face.license,data:Uint8Array.from(atob(face.dataUrl.split(',')[1]),character=>character.charCodeAt(0))})),{substitutionPolicy:'visual',fallbackFamily:'Roboto'});
const layoutOptions = {textMeasurement:fontRegistry.textMeasurement};
const editor = createEditorSession({
  name: 'A presentation you can work on',
  catalogs: {fontSchemes: {records: [{'$schema':'https://openpresentation.org/schema/opf-font-scheme/v1',id:'cambria',name:'Cambria',major:'Cambria',minor:'Cambria'}]}},
  design: { theme: 'classic', fontScheme: 'roboto' },
  slides: [{ id: 'recommendation', title: 'Start with a clear recommendation',
    composition: { mode: 'row', weights: [2, 1] },
    blocks: [
      { text: 'Double-click this text to edit it. The document remains plain JSON, and each change can be undone.' },
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
}, { rejectInvalid: true });
const element = id => document.getElementById(id);
let slideIndex = 0, selectedPath = 'slides.0.title', selectedValue, canvas, renderError;
function status(message) { element('status').textContent = message; }
let activePanel = 'content';
const thumbnailCache = new Map();
function showPanel(panel, focus = false) {
  activePanel = panel;
  for (const name of ['content', 'design']) {
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
function renderNavigator(deck) {
  element('slide-count').textContent = deck.slides.length;
  const liveKeys = new Set();
  element('slide-list').replaceChildren(...deck.slides.map((slide, index) => {
    const button = document.createElement('button');
    button.className = 'slide-card';
    button.setAttribute('aria-current', String(index === slideIndex));
    button.setAttribute('aria-label', `Slide ${index + 1}: ${slide.title ?? 'Untitled'}`);
    const number = document.createElement('span'); number.className = 'thumbnail-number'; number.textContent = String(index + 1).padStart(2, '0');
    const content = document.createElement('span'); content.className = 'thumbnail-content';
    const thumbnail = document.createElement('span'); thumbnail.className = 'thumbnail'; thumbnail.setAttribute('aria-hidden', 'true');
    const key = JSON.stringify([index, deck.slides.length, slide, deck.design, deck.catalogs, deck.assets]); liveKeys.add(key);
    if (!thumbnailCache.has(key)) {
      try {
        const svg = renderSvg(deck, {...layoutOptions, slideIndex:index, trace: false});
        thumbnailCache.set(key, svg);
      } catch { thumbnailCache.set(key, 'Preview unavailable'); }
    }
    thumbnail.innerHTML = thumbnailCache.get(key);
    // Thumbnail SVGs are decorative and never add a second keyboard focus target.
    thumbnail.querySelectorAll('[tabindex]').forEach(node => node.removeAttribute('tabindex'));
    const label = document.createElement('span'); label.className = 'thumbnail-title'; label.textContent = slide.title ?? 'Untitled slide';
    content.append(thumbnail, label); button.append(number, content);
    button.onclick = () => { slideIndex = index; render(); };
    button.onkeydown = event => {
      if (!['ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
      event.preventDefault();
      slideIndex = event.key === 'Home' ? 0 : event.key === 'End' ? deck.slides.length - 1 : Math.max(0, Math.min(deck.slides.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
      render(); element('slide-list').children[slideIndex]?.focus();
    };
    return button;
  }));
  for (const key of thumbnailCache.keys()) if (!liveKeys.has(key)) thumbnailCache.delete(key);
}

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
}
function render() {
  fontRegistry.clearSubstitutions();
  renderError = undefined;
  const deck = editor.document;
  slideIndex = Math.max(0, Math.min(slideIndex, deck.slides.length - 1));
  renderNavigator(deck);
  fontRegistry.clearSubstitutions();
  element('slide-number').textContent = String(slideIndex + 1).padStart(2, '0');
  element('slide-title').textContent = deck.slides[slideIndex].title ?? 'Untitled slide';
  element('page-position').textContent = `Slide ${slideIndex + 1} of ${deck.slides.length}`;
  element('document-name').value = deck.name ?? 'Untitled presentation';
  element('notes').value = deck.slides[slideIndex].notes ?? '';
  element('undo').disabled = !editor.canUndo; element('redo').disabled = !editor.canRedo;
  element('font').value = deck.design?.fontScheme ?? 'roboto';
  element('mode').value = deck.slides[slideIndex].composition?.mode ?? 'auto';
  const groupSelect = element('group');
  const previousGroup = groupSelect.value;
  const geometry = editor.composeSlide(slideIndex,layoutOptions);
  groupSelect.replaceChildren(...geometry.groups.map(group => {
    const option = document.createElement('option'); option.value = group.path; option.textContent = group.path.replace(`slides.${slideIndex}.`, ''); return option;
  }));
  if ([...groupSelect.options].some(option => option.value === previousGroup)) groupSelect.value = previousGroup;
  element('group-controls').hidden = !groupSelect.options.length;
  element('group-mode').value = editor.get(`${groupSelect.value}.composition.mode`, 'auto');
  element('undo').disabled = !editor.canUndo; element('redo').disabled = !editor.canRedo;
  element('json').value = JSON.stringify(deck, null, 2);
  const diagnostics = [];
  if (!canvas) canvas=createCanvasEditor(element('preview'),{
    editor,slideIndex,renderOptions:layoutOptions,propertiesContainer:element('canvas-properties'),
    onSelect:value=>{select(value.path);showPanel('content');},
    onDraft:value=>{element('json').value=JSON.stringify(value.document,null,2);status('Editing on the slide · Esc to cancel');},
    onCommit:()=>status('Changes saved in this session'),
    onCancel:()=>{element('json').value=JSON.stringify(editor.document,null,2);status('Edit cancelled');},
    onError:error=>status(error.message),
  });
  else canvas.setSlide(slideIndex);
  diagnostics.push(...geometry.diagnostics);
  diagnostics.push(...fontRegistry.substitutions.filter((change,index,all)=>all.findIndex(other=>other.requestedFamily===change.requestedFamily && other.requestedWeight===change.requestedWeight && other.italic===change.italic)===index).map(change=>({path:change.path ?? 'design.fontScheme',message:`${change.requestedFamily} → ${change.resolvedFamily} · ${change.compatibility === 'metric' ? 'Metric substitute' : 'Approximate substitute; wrapping may change'} (${change.resolvedWeight}).`})));
  element('diagnostics').replaceChildren(...diagnostics.map(issue => { const item = document.createElement('li'); item.textContent = issue.message; item.title = issue.path; return item; }));
  element('diagnostics-section').hidden = diagnostics.length === 0;
  element('diagnostic-count').textContent = diagnostics.length;
  updateZoom();
  if (!selectedPath.startsWith(`slides.${slideIndex}.`) || editor.get(selectedPath) === undefined) selectedPath = `slides.${slideIndex}.title`;
  select(selectedPath);
}
editor.subscribe(() => { try { render(); } catch (error) { renderError = error.message; canvas?.destroy(); canvas=undefined; element('preview').textContent = 'Preview unavailable for this document. Use Undo or revise the JSON.'; status(renderError); } });
element('apply').onclick = () => act(() => editor.set(selectedPath, typeof selectedValue === 'string' ? element('value').value : JSON.parse(element('value').value)));
element('undo').onclick = () => act(() => editor.undo());
element('redo').onclick = () => act(() => editor.redo());
element('font').onchange = () => act(() => editor.set('design.fontScheme', element('font').value));
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
element('paginate').onclick = () => act(() => editor.paginateSlide(slideIndex,layoutOptions));
element('add').onclick = () => act(() => {
  const deck = editor.document;
  let index = deck.slides.length + 1;
  while (deck.slides.some(slide => slide.id === `slide-${index}`)) index++;
  slideIndex = deck.slides.length;
  editor.applyPatch([{ op: 'add', path: '/slides/-', value: { id: `slide-${index}`, title: 'New slide', text: 'Write your next idea here.' } }]);
});
element('apply-json').onclick = () => {
  try {
    editor.applyPatch([{op:'replace',path:'',value:JSON.parse(element('json').value)}]);
    if (renderError) { element('json-error').textContent = renderError; return; }
    element('source-dialog').close(); status('Presentation source updated');
  } catch(error) { element('json-error').textContent = error.issues?.[0]?.message ?? error.message; }
};
element('open-json').onclick = () => { if(canvas && !canvas.commit())return; element('json').value = JSON.stringify(editor.document,null,2); element('json-error').textContent = ''; element('source-dialog').showModal();previewSource(); };
element('close-json').onclick = () => element('source-dialog').close();
let sourceFrame=0;
function previewSource() {
  try {
    const deck=JSON.parse(element('json').value);
    const svg=renderSvg(deck,{...layoutOptions,slideIndex:Math.min(slideIndex,(deck.slides?.length ?? 1)-1)});
    element('source-preview').innerHTML=svg;element('json-error').textContent='';element('apply-json').disabled=false;
  } catch(error) {element('json-error').textContent=error.issues?.[0]?.message ?? error.message;element('apply-json').disabled=true;}
}
element('json').addEventListener('input',()=>{cancelAnimationFrame(sourceFrame);sourceFrame=requestAnimationFrame(previewSource);});

for (const panel of ['content','design']) {
  element(`tab-${panel}`).onclick = () => showPanel(panel);
  element(`tab-${panel}`).onkeydown = event => {
    if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) { event.preventDefault(); showPanel(event.key==='Home' ? 'content' : event.key==='End' ? 'design' : activePanel==='content' ? 'design' : 'content',true); }
  };
}
element('zoom').onchange = updateZoom;
element('document-name').onchange = () => act(() => editor.set('name',element('document-name').value.trim() || 'Untitled presentation'));
element('document-name').onkeydown = event => { if(event.key==='Enter') event.currentTarget.blur(); };
element('apply-notes').onclick = () => act(() => editor.set(`slides.${slideIndex}.notes`,element('notes').value));
element('download').onclick = () => {
  if(canvas && !canvas.commit())return;
  const deck=editor.document, blob=new Blob([JSON.stringify(deck,null,2)],{type:'application/json'}), url=URL.createObjectURL(blob);
  const link=document.createElement('a'); link.href=url; link.download=`${(deck.name ?? 'presentation').replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'') || 'presentation'}.opf.json`;
  link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); status('OPF file downloaded');
};
document.addEventListener('keydown',event=>{
  if (!(event.metaKey || event.ctrlKey)) return;
  if (event.key==='Enter' && document.activeElement===element('value')) { event.preventDefault(); element('apply').click(); return; }
  if (event.key.toLowerCase()==='z' && !event.target.closest('input,textarea,[contenteditable]') && !element('source-dialog').open) {
    event.preventDefault(); act(()=>event.shiftKey ? editor.redo() : editor.undo());
  }
});
render();

const galleryConfig=await fetch('./galleries.json').then(response=>{if(!response.ok)throw new Error('Gallery configuration unavailable');return response.json();}).catch(()=>[{name:'PPTX.gallery',url:'https://www.pptx.gallery/registry.json'}]);
installTransferControls({editor,getCanvas:()=>canvas,getSlideIndex:()=>slideIndex,getSelectedPath:()=>selectedPath,setSlideIndex:value=>{slideIndex=value;},status,renderOptions:layoutOptions,galleries:galleryConfig});
installPptxExport({editor,getCanvas:()=>canvas,renderOptions:layoutOptions,status});

let propertiesInspector;
const propertiesDialog=element('properties-dialog');
element('open-properties').onclick=()=>{
 if(canvas&&!canvas.commit())return;
 propertiesDialog.showModal();
 propertiesInspector?.destroy();
 propertiesInspector=createSchemaInspector(element('schema-properties'),{editor,path:`/slides/${slideIndex}`,
  onDraft:({document:deck})=>{try{element('properties-preview').innerHTML=renderSvg(deck,{...layoutOptions,trace:true,slideIndex:Math.min(slideIndex,deck.slides.length-1)});element('properties-preview-status').textContent='Click slide content to find its field. Metadata is stored with the deck.';}catch(error){element('properties-preview-status').textContent='Preview unavailable: '+error.message;}},
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

installDataControls({editor,getCanvas:()=>canvas,getSlideIndex:()=>slideIndex,getSelectedPath:()=>selectedPath,setSlideIndex:value=>{slideIndex=value;},status,renderOptions:layoutOptions});
