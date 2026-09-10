import {richTextContent, updateRichTextInput} from './rich-text.js';

/** Native input owns keyboard/IME; caret and selection use the canonical SVG glyphs. */
export function createRichTextInput(root, overlay, {path, value, getTarget, onInput, onCommit, onCancel, onFormat, onError}) {
  const doc=root.ownerDocument, win=doc.defaultView;
  const input=doc.createElement('textarea'), marks=doc.createElement('div'), actions=doc.createElement('div');
  input.className='opf-rich-input';input.value=richTextContent(value);
  input.setAttribute('aria-label','Edit rich text inline');input.spellcheck=true;
  input.style.cssText='position:absolute;width:1px;padding:0;border:0;opacity:0;pointer-events:none;resize:none;overflow:hidden;z-index:3';
  marks.className='opf-rich-selection';marks.setAttribute('aria-hidden','true');marks.style.cssText='position:absolute;inset:0;pointer-events:none';
  actions.style.cssText='position:absolute;bottom:8px;left:8px;display:flex;gap:6px;pointer-events:auto;z-index:4';
  for(const [label,action] of [['Format selection',()=>onFormat(input.selectionStart,input.selectionEnd)],['Done',onCommit]]) {
    const button=doc.createElement('button');button.type='button';button.textContent=label;
    button.style.cssText='padding:6px 10px;background:#fff;color:#574774;border:1px solid #d5cce5;border-radius:5px';
    button.onmousedown=event=>event.preventDefault();button.onclick=action;actions.append(button);
  }
  overlay.append(marks,input,actions);
  let current=structuredClone(value), composing=false, change=null, anchor=null, disposed=false, emptyAnchor=null;
  let history=[{value:structuredClone(current),start:0,end:input.value.length}], historyIndex=0, compositionBase=null;
  function remember() {
    history.splice(historyIndex+1);history.push({value:structuredClone(current),start:input.selectionStart,end:input.selectionEnd});historyIndex++;
  }
  function fragments() { return [...(getTarget(path)?.querySelectorAll('text[data-opf-text-start]')??[])]; }
  function rect(node,start,end) {
    const range=doc.createRange();range.setStart(node.firstChild,start);range.setEnd(node.firstChild,end);return range.getBoundingClientRect();
  }
  function boundaries() {
    const result=[];
    for(const node of fragments()) {
      if(!node.firstChild)continue;
      const start=Number(node.dataset.opfTextStart),text=node.textContent;
      for(const part of new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)) {
        const box=rect(node,part.index,part.index+part.segment.length),rtl=win.getComputedStyle(node).direction==='rtl';
        result.push({offset:start+part.index,x:rtl?box.right:box.left,y:box.top,height:box.height,node});
        result.push({offset:start+part.index+part.segment.length,x:rtl?box.left:box.right,y:box.top,height:box.height,node});
      }
    }
    const target=getTarget(path),matrix=target?.getScreenCTM();
    if(matrix)for(const line of JSON.parse(target.dataset.opfRichLines??'[]')) {
      if(line.start!==line.end)continue;
      const point=new win.DOMPoint(line.x,line.y).matrixTransform(matrix);
      result.push({offset:line.start,x:point.x,y:point.y,height:line.height*Math.hypot(matrix.c,matrix.d)});
    }
    return result;
  }
  function update() {
    if(disposed)return;marks.replaceChildren();
    const origin=root.getBoundingClientRect(),start=input.selectionStart,end=input.selectionEnd;
    const append=(box,caret=false)=>{
      const mark=doc.createElement('div');mark.className=caret?'opf-rich-caret':'opf-rich-range';
      mark.style.cssText=`position:absolute;left:${box.left-origin.left}px;top:${box.top-origin.top}px;width:${caret?1.5:box.width}px;height:${Math.max(12,box.height)}px;background:${caret?(box.color??'#6551ba'):'#8975d955'}`;
      marks.append(mark);
    };
    if(start!==end)for(const node of fragments()) {
      const a=Math.max(0,start-Number(node.dataset.opfTextStart)),b=Math.min(node.textContent.length,end-Number(node.dataset.opfTextStart));
      if(a<b&&node.firstChild)append(rect(node,a,b));
    }
    const points=boundaries();
    if(points.length)emptyAnchor=points[0];
    const offset=input.selectionDirection==='backward'?start:end;
    // Prefer the beginning of the next fragment at wrapped line boundaries.
    const point=points.findLast(p=>p.offset===offset)??points.reduce((best,p)=>!best||Math.abs(p.offset-offset)<Math.abs(best.offset-offset)?p:best,null);
    const target=emptyAnchor?{left:emptyAnchor.x,top:emptyAnchor.y,width:1,height:emptyAnchor.height}:getTarget(path)?.getBoundingClientRect();
    const box=point?{left:point.x,top:point.y,width:1,height:point.height,color:point.node?win.getComputedStyle(point.node).fill:undefined}:target;
    if(box) {
      if(start===end)append(box,true);
      input.style.left=`${box.left-origin.left}px`;input.style.top=`${box.top-origin.top}px`;input.style.height=`${Math.max(20,box.height)}px`;
      if(point?.node)input.style.font=win.getComputedStyle(point.node).font;
    }
  }
  function nearest(event) {
    return boundaries().reduce((best,p)=>{
      const vertical=Math.max(p.y-event.clientY,0,event.clientY-p.y-p.height);
      const distance=vertical*vertical*100+Math.pow(p.x-event.clientX,2);
      return !best||distance<best.distance?{...p,distance}:best;
    },null)?.offset??0;
  }
  function pointerDown(event) {
    if(event.button!==0||!getTarget(path)?.contains(event.target))return;
    event.preventDefault();event.stopPropagation();
    anchor=event.shiftKey?input.selectionStart:nearest(event);input.focus({preventScroll:true});
    const end=nearest(event);input.setSelectionRange(Math.min(anchor,end),Math.max(anchor,end),end<anchor?'backward':'forward');
    root.setPointerCapture(event.pointerId);update();
  }
  function pointerMove(event) {
    if(anchor===null)return;event.preventDefault();const end=nearest(event);
    input.setSelectionRange(Math.min(anchor,end),Math.max(anchor,end),end<anchor?'backward':'forward');update();
  }
  function pointerUp(event) {if(anchor!==null){anchor=null;if(root.hasPointerCapture(event.pointerId))root.releasePointerCapture(event.pointerId);}}
  function undo(direction) {
    const next=historyIndex+direction;if(next<0||next>=history.length)return;
    historyIndex=next;const saved=history[next];current=structuredClone(saved.value);input.value=richTextContent(current);
    input.setSelectionRange(saved.start,saved.end);onInput(current);update();
  }
  input.addEventListener('beforeinput',event=>{
    if(event.inputType==='historyUndo'||event.inputType==='historyRedo'){event.preventDefault();undo(event.inputType==='historyUndo'?-1:1);return;}
    change={start:input.selectionStart,end:input.selectionEnd,inputType:event.inputType};
    if(!composing){history[historyIndex].start=input.selectionStart;history[historyIndex].end=input.selectionEnd;}
  });
  input.addEventListener('input',()=>{
    try{current=updateRichTextInput(current,input.value,change);change=null;if(!composing)remember();onInput(current);update();}
    catch(error){input.value=richTextContent(current);change=null;onError(error);}
  });
  input.addEventListener('compositionstart',()=>{composing=true;compositionBase=JSON.stringify(current);});
  input.addEventListener('compositionend',()=>{composing=false;if(JSON.stringify(current)!==compositionBase)remember();onInput(current);update();});
  input.addEventListener('keydown',event=>{
    if(event.isComposing||composing)return;
    if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.stopPropagation();undo(event.shiftKey?1:-1);}
    else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onCancel();}
    else if(event.key==='Enter'&&(event.metaKey||event.ctrlKey)){event.preventDefault();onCommit();}
  });
  input.addEventListener('select',update);input.addEventListener('keyup',update);
  input.addEventListener('blur',()=>{if(!disposed&&!composing)onCommit();});
  root.addEventListener('pointerdown',pointerDown,true);root.addEventListener('pointermove',pointerMove);root.addEventListener('pointerup',pointerUp);root.addEventListener('pointercancel',pointerUp);
  input.focus({preventScroll:true});input.select();update();
  return {input,update,get value(){return structuredClone(current);},get composing(){return composing;},destroy(){disposed=true;root.removeEventListener('pointerdown',pointerDown,true);root.removeEventListener('pointermove',pointerMove);root.removeEventListener('pointerup',pointerUp);root.removeEventListener('pointercancel',pointerUp);marks.remove();input.remove();actions.remove();}};
}
