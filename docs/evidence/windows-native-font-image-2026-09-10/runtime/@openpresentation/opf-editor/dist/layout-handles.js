import {prepareTrackResize} from './layout.js';
import {getValueAtPath} from './index.js';

export function createLayoutHandles(root, options) {
  const doc=root.ownerDocument,win=doc.defaultView,editor=options.editor;
  const layer=doc.createElement('div');
  layer.className='opf-layout-handles';
  layer.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:3';
  root.append(layer);
  let enabled=options.enabled??false,active=null,committing=false,frame=0,lastGeometry;
  const signature=(path)=>JSON.stringify(editor.get(path));
  const trackData=flow=>flow.composition.mode==='column'?{axis:'y',size:'height',tracks:flow.rows}:{axis:'x',size:'width',tracks:flow.columns};
  function renderCanonical(){options.render();}
  function release(edit){if(edit?.pointerId!==undefined&&layer.hasPointerCapture(edit.pointerId))layer.releasePointerCapture(edit.pointerId);}
  function cancel(clear=true) {
    if(!active)return;
    const edit=active;active=null;if(frame)win.cancelAnimationFrame(frame);frame=0;release(edit);
    renderCanonical();if(clear)options.onCancel?.({path:edit.flow.path});
  }
  function preview(fraction) {
    if(!active)return false;
    const edit=active;
    edit.fraction=fraction;
    try{
      const prepared=prepareTrackResize(editor.document,active.flow,active.boundary,fraction);
      options.render(prepared.document);
      if(active!==edit)return false;
      edit.prepared=prepared;edit.valid=true;
      options.onDraft?.({document:prepared.document,path:active.flow.path+'.composition',value:prepared.composition});
      if(active!==edit)return false;
      options.clearError?.();return true;
    }catch(error){if(active===edit)edit.valid=false;options.onError(error);return false;}
  }
  function commit() {
    if(!active)return true;
    if(frame){win.cancelAnimationFrame(frame);frame=0;preview(active.fraction);}
    if(!active)return false;
    const edit=active;
    if(signature(edit.flow.path)!==edit.base){cancel(false);options.onError(new Error('The layout changed elsewhere. The resize was cancelled.'));return false;}
    if(!edit.valid){cancel(false);return false;}
    active=null;release(edit);committing=true;
    try{
      // Rebase unrelated document edits, retaining the guarded container.
      const prepared=prepareTrackResize(editor.document,edit.flow,edit.boundary,edit.fraction);
      if(edit.moved)editor.applyPatch(prepared.patches,{source:'canvas-layout',rejectInvalid:true});
      else renderCanonical();
      options.onCommit?.({path:edit.flow.path+'.composition',editor});return true;
    }catch(error){renderCanonical();options.onError(error);return false;}
    finally{committing=false;}
  }
  function begin(flow,boundary,event) {
    if(!options.beforeEdit())return false;
    if(active&&!commit())return false;
    const {axis,tracks}=trackData(flow),a=tracks[boundary],b=tracks[boundary+1];
    active={flow:structuredClone(flow),boundary,base:signature(flow.path),fraction:a.size/(a.size+b.size),initial:a.size/(a.size+b.size),pair:a.size+b.size,axis,valid:true,moved:false,pointerId:event?.pointerId,origin:event?(axis==='x'?event.clientX:event.clientY):0};
    if(event)layer.setPointerCapture(event.pointerId);
    return true;
  }
  function update(document,geometry) {
    lastGeometry=geometry;
    layer.replaceChildren();
    if(!enabled||options.isTextEditing())return;
    for(const flow of geometry.flows??[]){
      const {axis,size,tracks}=trackData(flow);
      if(tracks.length<2||tracks.length>12||flow.itemCount!==flow.slotCount)continue;
      for(let boundary=0;boundary<tracks.length-1;boundary++){
        const track=tracks[boundary],next=tracks[boundary+1],vertical=axis==='x';
        const node=doc.createElement('div');node.tabIndex=0;node.setAttribute('role','separator');
        node.dataset.layoutPath=flow.path;node.dataset.layoutBoundary=String(boundary);
        node.setAttribute('aria-label',`Resize ${flow.path} ${vertical?'columns':'rows'} ${boundary+1} and ${boundary+2}`);
        node.setAttribute('aria-orientation',vertical?'vertical':'horizontal');
        node.setAttribute('aria-valuemin','5');node.setAttribute('aria-valuemax','95');
        node.setAttribute('aria-valuenow',String(Math.round(100*track.size/(track.size+next.size))));
        node.setAttribute('aria-valuetext',`${Math.round(100*track.size/(track.size+next.size))}% of adjacent tracks`);
        node.title='Drag to resize · Arrow keys adjust · Shift adjusts faster · Esc cancels';
        const at=flow.box[axis]+track.offset+track.size+flow.gap/2;
        node.style.cssText=`position:absolute;pointer-events:auto;touch-action:none;cursor:${vertical?'col':'row'}-resize;box-sizing:border-box;border-radius:5px;background:#8a78d733;outline-offset:2px;${vertical?`left:calc(${at/geometry.width*100}% - 5px);top:${flow.box.y/geometry.height*100}%;width:10px;height:${flow.box.height/geometry.height*100}%`:`top:calc(${at/geometry.height*100}% - 5px);left:${flow.box.x/geometry.width*100}%;height:10px;width:${flow.box.width/geometry.width*100}%`}`;
        const grip=doc.createElement('span');grip.style.cssText=`position:absolute;border-radius:2px;background:#8170d5;${vertical?'left:4px;top:0;bottom:0;width:2px':'top:4px;left:0;right:0;height:2px'}`;node.append(grip);
        node.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();try{begin(flow,boundary,event);}catch(error){options.onError(error);}};
        node.onkeydown=event=>{
          const keys=vertical?['ArrowLeft','ArrowRight']:['ArrowUp','ArrowDown'];
          if(event.key==='Escape'){event.preventDefault();cancel();return;}
          if(!keys.includes(event.key)&&!['Home','End'].includes(event.key))return;
          event.preventDefault();event.stopPropagation();
          if(!begin(flow,boundary))return;
          active.moved=true;
          const fraction=event.key==='Home' ? .05 : event.key==='End' ? .95 : active.initial+(event.key===keys[1]?1:-1)*(event.shiftKey ? .05 : .01);
          preview(Math.max(0,Math.min(1,fraction)));commit();
          [...layer.children].find(child=>child.dataset.layoutPath===flow.path&&child.dataset.layoutBoundary===String(boundary))?.focus();
        };
        layer.append(node);
      }
    }
  }
  layer.addEventListener('pointermove',event=>{
    if(!active||event.pointerId!==active.pointerId)return;
    const svg=root.querySelector('.opf-canvas-preview svg'),rect=svg.getBoundingClientRect();
    const scale=rect.width/(lastGeometry?.width??1280);
    const current=active.axis==='x'?event.clientX:event.clientY;
    active.fraction=Math.max(0,Math.min(1,active.initial+(current-active.origin)/(scale*active.pair)));
    if(Math.abs(current-active.origin)<1&&!active.moved)return;
    active.moved=true;if(frame)win.cancelAnimationFrame(frame);
    frame=win.requestAnimationFrame(()=>{frame=0;if(active)preview(active.fraction);});
  });
  layer.addEventListener('pointerup',event=>{if(active?.pointerId===event.pointerId)commit();});
  layer.addEventListener('pointercancel',event=>{if(active?.pointerId===event.pointerId)cancel();});
  layer.addEventListener('lostpointercapture',event=>{if(active?.pointerId===event.pointerId)cancel();});
  const escape=event=>{if(event.key==='Escape'&&active){event.preventDefault();event.stopPropagation();cancel();}};
  doc.addEventListener('keydown',escape,true);
  const unsubscribe=editor.subscribe(()=>{
    if(committing||!active)return;
    if(signature(active.flow.path)!==active.base){cancel(false);options.onError(new Error('The layout changed elsewhere. The resize was cancelled.'));}
    else preview(active.fraction);
  });
  return {update,commit,cancel,hide(){layer.replaceChildren();},get editingPath(){return active?.flow.path??null;},get enabled(){return enabled;},setEnabled(value){if(!commit())return false;enabled=!!value;renderCanonical();return true;},destroy(){if(frame)win.cancelAnimationFrame(frame);active=null;unsubscribe();doc.removeEventListener('keydown',escape,true);layer.remove();}};
}
