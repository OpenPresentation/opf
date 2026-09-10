import {richTextContent, formatRichTextRange, replaceRichTextRange} from './rich-text.js';

/** Native SVG selection stays on the exact rendered glyphs; no HTML reflow. */
export function createRichTextToolbar(root, {editor, report, beforeChange, onProperties, onTyping, validateChange, onChange}) {
  const doc = root.ownerDocument, win = doc.defaultView;
  const toolbar = doc.createElement('div');
  toolbar.className = 'opf-rich-toolbar';
  toolbar.setAttribute('role','toolbar'); toolbar.setAttribute('aria-label','Text formatting');
  toolbar.style.cssText = 'position:absolute;left:8px;bottom:8px;max-width:calc(100% - 16px);display:flex;flex-wrap:wrap;gap:5px;align-items:center;padding:8px;border:1px solid #d5cde5;border-radius:8px;background:#fff;color:#332e40;box-shadow:0 4px 20px #28203922;z-index:5;font:12px/1.4 system-ui;pointer-events:auto';
  root.append(toolbar);
  let selected = null, restoring = false;
  const buttons = new Map();
  const hide = () => {selected = null; toolbar.style.display = 'none';};
  const button = (label, action) => {
    const node = doc.createElement('button'); node.type='button'; node.textContent=label;
    node.style.cssText='padding:4px 7px;border:1px solid #ded8e8;border-radius:4px;background:#faf9fc;color:inherit;cursor:pointer';
    node.addEventListener('mousedown',event=>event.preventDefault());
    node.onclick=()=>{try {action();} catch(error) {report(error);}};
    toolbar.append(node); return node;
  };
  function currentRuns() {
    if (!selected) return [];
    const value=editor.get(selected.path), result=[];let offset=0;
    for (const run of typeof value==='string'?[value]:value) {
      const text=typeof run==='string'?run:run.text;
      if (offset<selected.end && offset+text.length>selected.start) result.push(typeof run==='string'?{}:run);
      offset+=text.length;
    }
    return result;
  }
  function common(key) {
    const values=currentRuns().map(run=>run[key]);
    return values.length && values.every(value=>value===values[0]) ? values[0] : undefined;
  }
  function sync() {
    if (!selected) return;
    toolbar.style.display='flex';
    for (const [key,node] of buttons) {
      const values=currentRuns().map(run=>!!run[key]), mixed=values.some(Boolean)&&!values.every(Boolean);
      node.setAttribute('aria-pressed',mixed?'mixed':String(values.every(Boolean)));
      node.style.background=values.every(Boolean)?'#eae4fa':'#faf9fc';
    }
    color.value=common('color')??'';size.value=common('fontSize')??'';
    family.value=common('fontFamily')??'';link.value=common('link')??'';
    replacement.value=richTextContent(editor.get(selected.path)).slice(selected.start,selected.end);
    status.textContent=`${selected.end-selected.start} characters selected`;
  }
  function restore() {
    if (!selected) return;
    const nodes=[...root.querySelectorAll('text[data-opf-text-start]')].filter(node=>node.closest('[data-opf-path]')?.getAttribute('data-opf-path')===selected.path);
    const a=nodes.find(node=>+node.dataset.opfTextStart<=selected.start&&+node.dataset.opfTextEnd>selected.start);
    const b=nodes.findLast(node=>+node.dataset.opfTextStart<selected.end&&+node.dataset.opfTextEnd>=selected.end);
    if (!a?.firstChild || !b?.firstChild) return;
    const range=doc.createRange(); range.setStart(a.firstChild,selected.start-Number(a.dataset.opfTextStart));range.setEnd(b.firstChild,selected.end-Number(b.dataset.opfTextStart));
    const selection=win.getSelection(); selection.removeAllRanges();selection.addRange(range);
  }
  function apply(format, text) {
    if (!selected) return;
    const snapshot=selected;
    if (JSON.stringify(editor.get(snapshot.path))!==snapshot.base) {hide();throw new Error('The text changed elsewhere. Select it again before formatting.');}
    if (beforeChange && !beforeChange()) return;
    if (JSON.stringify(editor.get(snapshot.path))!==snapshot.base) {hide();throw new Error("Finish the active edit, then select text again.");}
    const value=editor.get(snapshot.path);
    const next=text===undefined ? formatRichTextRange(value,snapshot.start,snapshot.end,format) : replaceRichTextRange(value,snapshot.start,snapshot.end,text);
    validateChange?.(snapshot.path,next);
    restoring=true;
    try {
      editor.set(snapshot.path,next,{source:'canvas-rich-text',rejectInvalid:true});
      selected={...snapshot,base:JSON.stringify(editor.get(snapshot.path)),end:text===undefined?snapshot.end:snapshot.start+text.length};
      if(selected.end===selected.start) hide();else {restore();sync();}
      onChange?.(snapshot.path);
    } finally {restoring=false;}
  }
  for(const [key,label] of [['bold','Bold'],['italic','Italic'],['underline','Underline'],['strikethrough','Strike'],['superscript','Superscript'],['subscript','Subscript']])
    buttons.set(key,button(label,()=>apply({[key]:!currentRuns().every(run=>!!run[key])})));
  function field(label,type='text') {
    const input=doc.createElement('input');input.type=type;input.setAttribute('aria-label',label);input.placeholder=label;
    input.style.cssText='width:90px;min-width:0;padding:4px 6px;border:1px solid #ded8e8;border-radius:4px;background:white;color:inherit;font:inherit';
    input.onkeydown=event=>{if(event.key==='Enter') {event.preventDefault();input.dispatchEvent(new win.Event('change'));}};
    toolbar.append(input);return input;
  }
  const color=field('Text color');
  color.onchange=()=>{try {if(color.value&&!/^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(color.value))throw new Error('Use a hex text color, such as #2563eb.');apply({color:color.value||null});}catch(error){report(error);}};
  const size=field('Font size (pt)','number');size.min='0.1';size.step='0.5';size.style.width='80px';
  size.onchange=()=>{try{apply({fontSize:size.value?Number(size.value):null});}catch(error){report(error);}};
  const family=field('Font family');family.onchange=()=>{try{apply({fontFamily:family.value||null});}catch(error){report(error);}};
  const link=field('Link URL');link.onchange=()=>{try{if(link.value&&!/^(https?:|mailto:)/i.test(link.value))throw new Error('Use an HTTP, HTTPS, or mailto link.');apply({link:link.value||null});}catch(error){report(error);}};
  const replacement=field('Selected text');replacement.style.width='160px';
  replacement.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();try{apply(null,replacement.value);}catch(error){report(error);}}};
  button('Replace text',()=>apply(null,replacement.value));
  button('Reset style',()=>apply(Object.fromEntries(['bold','italic','underline','strikethrough','superscript','subscript','color','fontSize','fontFamily','link'].map(key=>[key,null]))));
  button('Edit text',()=>{const path=selected?.path;hide();if(path)onTyping?.(path);});
  button('Edit runs',()=>{const path=selected?.path;hide();if(path)onProperties?.(path);});
  button('Done',()=>{hide();win.getSelection()?.removeAllRanges();});
  const status=doc.createElement('span');status.style.fontSize='11px';toolbar.append(status);
  toolbar.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();hide();}
    if(event.target.tagName==='BUTTON'&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
      const controls=[...toolbar.querySelectorAll('button,input')],index=controls.indexOf(event.target);
      const next=event.key==='Home'?0:event.key==='End'?controls.length-1:(index+(event.key==='ArrowRight'?1:-1)+controls.length)%controls.length;
      event.preventDefault();controls[next].focus();
    }});
  function endpoint(node,offset) {
    if(node?.nodeType!==3) return null;
    const element=node.parentElement?.closest('text[data-opf-text-start]');
    if(!element||!root.contains(element)||element.hasAttribute('data-opf-code-role'))return null;
    return {path:element.closest('[data-opf-path]')?.getAttribute('data-opf-path'),offset:Number(element.dataset.opfTextStart)+offset};
  }
  function selectionChanged() {
    if(restoring||toolbar.contains(doc.activeElement))return;
    const selection=win.getSelection();
    if(!selection?.rangeCount||selection.isCollapsed){hide();return;}
    const range=selection.getRangeAt(0),a=endpoint(range.startContainer,range.startOffset),b=endpoint(range.endContainer,range.endOffset);
    if(!a||!b||a.path!==b.path||a.offset>=b.offset){hide();return;}
    selected={path:a.path,start:a.offset,end:b.offset,base:JSON.stringify(editor.get(a.path))};sync();
  }
  doc.addEventListener('selectionchange',selectionChanged);
  const unsubscribe=editor.subscribe(()=>{if(!restoring)hide();});
  hide();
  function selectRange(path,start,end) {
    const value=editor.get(path);if(!Array.isArray(value)||start>=end)return false;
    selected={path,start,end,base:JSON.stringify(value)};restore();sync();return true;
  }
  return {hide,selectRange,selectAll(path) {
    const value=editor.get(path);if(!Array.isArray(value))return false;
    const end=richTextContent(value).length;if(!end)return false;
    selected={path,start:0,end,base:JSON.stringify(value)};restore();sync();return true;
  },destroy(){doc.removeEventListener('selectionchange',selectionChanged);unsubscribe();toolbar.remove();}};
}
