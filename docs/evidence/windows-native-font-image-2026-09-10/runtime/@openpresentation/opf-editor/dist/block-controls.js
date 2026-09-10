import {prepareBlockMove,listBlockContainers,prepareBlockInsert,prepareBlockDuplicate,prepareBlockRemove,createContentBlock} from './blocks.js';
import {getValueAtPath,splitOpfPath,opfPathToJsonPointer,applyJsonPatch} from './index.js';

/** Arrange-mode block handles. Native drag reorders siblings; the menu also reparents blocks. */
export function createBlockControls(root, options) {
  const doc=root.ownerDocument,editor=options.editor;
  const layer=doc.createElement('div');layer.className='opf-block-controls';
  layer.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:4';root.append(layer);
  let cells=[],geometry,drag=null,panel=null,committing=false,returnFocus=null;
  const signature=path=>JSON.stringify(editor.get(path));
  const clearMarker=()=>layer.querySelector('[data-block-drop]')?.remove();
  function cancel(){drag=null;clearMarker();const restore=panel?.contains(doc.activeElement);panel?.remove();panel=null;if(restore&&returnFocus?.isConnected)returnFocus.focus();returnFocus=null;}
  function apply(prepared){
    if(!prepared?.changed){cancel();return true;}
    // Retain changes outside the guarded containers and preflight the exact candidate.
    const candidate=applyJsonPatch(editor.document,prepared.patches);
    options.validate(candidate);
    committing=true;
    try{cancel();editor.applyPatch(prepared.patches,{source:'canvas-block-edit',rejectInvalid:true});options.onMove?.(prepared.path);([ ...layer.querySelectorAll("[data-block-path]")].find(node=>node.dataset.blockPath===prepared.path)??layer.querySelector('[data-block-add]'))?.focus();options.clearError?.();options.onCommit?.({path:prepared.path,editor});return true;}
    finally{committing=false;}
  }
  function move(from,to,index,base=editor.document){
    try{return apply(prepareBlockMove(base,from,to,index));}catch(error){cancel();options.onError(error);return false;}
  }
  function open(path){
    if(!options.beforeEdit())return;
    cancel();returnFocus=doc.activeElement;path=opfPathToJsonPointer(path);const base=editor.document,parts=splitOpfPath(path),container=opfPathToJsonPointer(parts.slice(0,-2)),index=Number(parts.at(-1));
    const source=getValueAtPath(base,[...parts.slice(0,-2),'blocks']);
    if(parts.at(-2)!=='blocks'||!Number.isInteger(index)||index<0||!Array.isArray(source)||index>=source.length){options.onError(new Error('Choose an existing content block.'));return;}
    const count=source.length;
    panel=doc.createElement('div');panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Move content block');
    panel.style.cssText='position:absolute;right:8px;bottom:8px;width:280px;max-width:calc(100% - 16px);box-sizing:border-box;padding:14px;background:white;color:#332e40;border:1px solid #d5cde5;border-radius:8px;box-shadow:0 5px 24px #28203922;pointer-events:auto;font:12px/1.5 system-ui;z-index:3';
    const heading=doc.createElement('strong');heading.textContent='Move content';panel.append(heading);
    const button=(label,handler,disabled=false)=>{const b=doc.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;b.style.cssText='margin:6px 5px 0 0;padding:5px 8px;border:1px solid #ded8e8;border-radius:4px;background:#faf9fc;color:inherit;cursor:pointer';b.onclick=handler;panel.append(b);return b;};
    button('Earlier',()=>move(path,container,index-1,base),index===0);
    button('Later',()=>move(path,container,index+2,base),index===count-1);
    const label=doc.createElement('label');label.textContent='Destination';label.style.cssText='display:block;margin-top:10px';
    const destinations=doc.createElement('select');destinations.setAttribute('aria-label','Move destination');destinations.style.cssText='display:block;width:100%;padding:6px;margin-top:4px';
    const containers=listBlockContainers(base).filter(item=>item.path!==path&&!item.path.startsWith(path+'/'));
    for(const item of containers){const option=doc.createElement('option');option.value=item.path;option.textContent=item.label;destinations.append(option);}destinations.value=container;label.append(destinations);panel.append(label);
    const positionLabel=doc.createElement('label');positionLabel.textContent='Position';positionLabel.style.cssText='display:block;margin-top:8px';
    const positions=doc.createElement('select');positions.setAttribute('aria-label','Move position');positions.style.cssText='display:block;width:100%;padding:6px;margin-top:4px';positionLabel.append(positions);panel.append(positionLabel);
    function fillPositions(){positions.replaceChildren();const selected=containers.find(c=>c.path===destinations.value);for(let i=0;i<=selected.count;i++){const option=doc.createElement('option');option.value=String(i);option.textContent=i===selected.count?'At the end':`Before block ${i+1}`;positions.append(option);}positions.value=destinations.value===container?String(index):String(selected.count);}
    destinations.onchange=fillPositions;fillPositions();
    button('Move',()=>move(path,destinations.value,Number(positions.value),base));
    button('Duplicate',()=>change(()=>prepareBlockDuplicate(base,path)));
    button('Delete',()=>change(()=>prepareBlockRemove(base,path)));
    button('Add after',()=>openInsert(container,index+1));
    if(Array.isArray(source[index].blocks))button('Add inside',()=>openInsert(path));
    button('Cancel',cancel);
    panel.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancel();}};
    layer.append(panel);destinations.focus();
  }
  function change(prepare) {
    try{return apply(prepare());}catch(error){options.onError(error);return false;}
  }
  function openInsert(containerPath,index) {
    if(!options.beforeEdit())return;
    cancel();returnFocus=doc.activeElement;const base=editor.document;
    const containers=listBlockContainers(base,{slideIndex:options.slideIndex(),includeImplicit:true});
    if(!containers.length){options.onError(new Error('No content container is available on this slide.'));return;}
    const requested=containerPath===undefined?containers[0].path:opfPathToJsonPointer(containerPath);
    if(!containers.some(c=>c.path===requested)){options.onError(new Error('Choose a content container on this slide.'));return;}
    if(index!==undefined&&(!Number.isInteger(index)||index<0||index>containers.find(c=>c.path===requested).count)){options.onError(new Error('Insertion index is out of range.'));return;}
    panel=doc.createElement('div');panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Add content');
    panel.style.cssText='position:absolute;right:8px;top:40px;width:300px;max-width:calc(100% - 16px);max-height:calc(100% - 48px);overflow:auto;box-sizing:border-box;padding:14px;background:white;color:#332e40;border:1px solid #d5cde5;border-radius:8px;box-shadow:0 5px 24px #28203922;pointer-events:auto;font:12px/1.5 system-ui;z-index:3';
    const heading=doc.createElement('strong');heading.textContent='Add content';panel.append(heading);
    function field(label,node){const wrapper=doc.createElement('label');wrapper.textContent=label;wrapper.style.cssText='display:block;margin-top:10px';node.setAttribute('aria-label',label);node.style.cssText='display:block;box-sizing:border-box;width:100%;padding:6px;margin-top:4px';wrapper.append(node);panel.append(wrapper);return wrapper;}
    const kind=doc.createElement('select');for(const [value,label] of [['text','Text'],['list','List'],['chart','Chart'],['table','Table'],['metric','Metric'],['quote','Quote'],['code','Code'],['timeline','Timeline'],['group','Group'],['image','Image'],['video','Video']]){const option=doc.createElement('option');option.value=value;option.textContent=label;kind.append(option);}field('Content type',kind);
    const destinations=doc.createElement('select');for(const item of containers){const option=doc.createElement('option');option.value=item.path;option.textContent=item.label;destinations.append(option);}destinations.value=requested;field('Add destination',destinations);
    const positions=doc.createElement('select');field('Add position',positions);
    function positionsFor(){positions.replaceChildren();const count=containers.find(c=>c.path===destinations.value).count;for(let i=0;i<=count;i++){const option=doc.createElement('option');option.value=String(i);option.textContent=i===count?'At the end':`Before block ${i+1}`;positions.append(option);}positions.value=String(destinations.value===requested&&index!==undefined?Math.min(index,count):count);}
    destinations.onchange=positionsFor;positionsFor();
    const source=doc.createElement('input');source.type='text';const media=field('Media URL or asset reference',source);media.style.display='none';
    const file=doc.createElement('input');file.type='file';file.accept='image/png,image/jpeg,image/webp';const upload=field('Or choose an image',file);upload.style.display='none';
    let loading=false,fileRevision=0;const thisPanel=panel;
    const add=doc.createElement('button');add.type='button';add.textContent='Add';add.style.cssText='margin:12px 6px 0 0;padding:6px 12px;border:1px solid #bfb1de;border-radius:4px;background:#ede7f9;color:inherit;cursor:pointer';
    const close=doc.createElement('button');close.type='button';close.textContent='Cancel';close.onclick=cancel;close.style.cssText=add.style.cssText;
    const cancelRead=()=>{fileRevision++;loading=false;add.disabled=false;};
    source.oninput=()=>{cancelRead();file.value='';};
    kind.onchange=()=>{cancelRead();media.style.display=['image','video'].includes(kind.value)?'block':'none';upload.style.display=kind.value==='image'?'block':'none';};
    file.onchange=()=>{
      cancelRead();const revision=fileRevision,chosen=file.files?.[0];if(!chosen)return;
      if(!['image/png','image/jpeg','image/webp'].includes(chosen.type)){options.onError(new Error('Choose a PNG, JPEG or WebP image.'));return;}
      loading=true;add.disabled=true;const reader=new doc.defaultView.FileReader();
      reader.onload=()=>{if(panel!==thisPanel||revision!==fileRevision)return;source.value=String(reader.result);loading=false;add.disabled=false;};
      reader.onerror=()=>{if(panel!==thisPanel||revision!==fileRevision)return;loading=false;add.disabled=false;options.onError(new Error('The image file could not be read.'));};
      reader.readAsDataURL(chosen);
    };
    add.onclick=()=>{if(!loading)change(()=>prepareBlockInsert(base,destinations.value,createContentBlock(kind.value,{source:source.value}),Number(positions.value)));};
    panel.append(add,close);panel.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancel();}};
    layer.append(panel);kind.focus();
  }
  function update(document,nextGeometry){
    geometry=nextGeometry;
    if(drag)return;
    cancel();layer.replaceChildren();cells=[];
    if(!options.enabled()||options.isEditing())return;
    const add=doc.createElement('button');add.type='button';add.textContent='+ Add content';add.setAttribute('aria-label','Add content');add.dataset.blockAdd='';
    add.style.cssText='position:absolute;right:8px;top:8px;pointer-events:auto;padding:5px 9px;background:#f6f3fc;color:#675394;border:1px solid #cfc4e7;border-radius:5px;font:12px system-ui;cursor:pointer';add.onclick=()=>openInsert();layer.append(add);
    for(const flow of geometry.flows??[]){
      const blocks=getValueAtPath(document,[...splitOpfPath(flow.path),'blocks']);
      if(!Array.isArray(blocks)||blocks.length!==flow.itemCount)continue;
      blocks.forEach((block,index)=>{
        const col=flow.columns[index%flow.columns.length],row=flow.rows[Math.floor(index/flow.columns.length)];if(!col||!row)return;
        const path=opfPathToJsonPointer([...splitOpfPath(flow.path),'blocks',String(index)]),container=opfPathToJsonPointer(flow.path);
        const box={x:flow.box.x+col.offset,y:flow.box.y+row.offset,width:col.size,height:row.size};
        const depth=splitOpfPath(path).filter(p=>p==='blocks').length;
        const node=doc.createElement('button');node.type='button';node.draggable=true;node.dataset.blockPath=path;
        node.textContent=Array.isArray(block.blocks)?`Group ${index+1} ⋮⋮`:`${index+1} ⋮⋮`;
        node.setAttribute('aria-label',`Move ${Array.isArray(block.blocks)?'group':'block'} ${index+1} in ${flow.path===`slides.${options.slideIndex()}`?'slide':'group'}`);
        node.title='Drag to reorder · Click to move between groups · Arrow keys reorder';
        node.style.cssText=`position:absolute;pointer-events:auto;touch-action:none;cursor:grab;left:calc(${(box.x+box.width)/geometry.width*100}% - ${Array.isArray(block.blocks)?70:38}px);top:calc(${box.y/geometry.height*100}% + ${(depth-1)*23}px);height:22px;min-width:34px;padding:2px 5px;background:#f6f3fc;color:#675394;border:1px solid #cfc4e7;border-radius:4px;font:11px system-ui;z-index:${depth}`;
        const cell={path,container,index,box,axis:flow.composition.mode==='column'?'y':'x',node};cells.push(cell);
        node.onclick=()=>open(path);
        node.onkeydown=event=>{if(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(event.key)){event.preventDefault();event.stopPropagation();if(!options.beforeEdit())return;const delta=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1;if(index+delta>=0&&index+delta<blocks.length)move(path,container,index+(delta>0?2:-1));}};
        node.ondragstart=event=>{
          if(!options.beforeEdit()){event.preventDefault();return;}
          cancel();drag={from:path,container,index,base:editor.document,signature:signature(container),cells:[...cells],prepared:null};
          event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',path);
        };
        node.ondragend=()=>{cancel();options.render();};layer.append(node);
      });
    }
  }
  function over(event){
    if(!drag)return;
    const rect=root.querySelector('.opf-canvas-preview svg').getBoundingClientRect();
    const x=(event.clientX-rect.left)*geometry.width/rect.width,y=(event.clientY-rect.top)*geometry.height/rect.height;
    const target=drag.cells.find(cell=>cell.container===drag.container&&x>=cell.box.x&&x<=cell.box.x+cell.box.width&&y>=cell.box.y&&y<=cell.box.y+cell.box.height);
    clearMarker();drag.prepared=null;if(!target)return;
    event.preventDefault();event.dataTransfer.dropEffect='move';
    const after=target.axis==='x'?x>target.box.x+target.box.width/2:y>target.box.y+target.box.height/2;
    try{drag.prepared=prepareBlockMove(drag.base,drag.from,target.container,target.index+(after?1:0));}catch(error){options.onError(error);return;}
    const marker=doc.createElement('div');marker.dataset.blockDrop='';const vertical=target.axis==='x',box=target.box;
    marker.style.cssText=`position:absolute;pointer-events:none;background:#7765d0;z-index:10;${vertical?`left:${(box.x+(after?box.width:0))/geometry.width*100}%;top:${box.y/geometry.height*100}%;width:3px;height:${box.height/geometry.height*100}%`:`top:${(box.y+(after?box.height:0))/geometry.height*100}%;left:${box.x/geometry.width*100}%;height:3px;width:${box.width/geometry.width*100}%`}`;layer.append(marker);
  }
  function drop(event){if(!drag)return;event.preventDefault();const prepared=drag.prepared;try{apply(prepared);}catch(error){cancel();options.onError(error);}finally{cancel();options.render();}}
  const escape=event=>{if(event.key==='Escape'&&(drag||panel)){event.preventDefault();event.stopPropagation();cancel();options.render();}};
  root.addEventListener('dragover',over);root.addEventListener('drop',drop);doc.addEventListener('keydown',escape,true);
  const unsubscribe=editor.subscribe(()=>{if(committing)return;if(drag&&signature(drag.container)!==drag.signature){cancel();options.onError(new Error('The block container changed elsewhere. Start the move again.'));}if(panel)cancel();});
  return {update,cancel,open,openInsert,hide(){cancel();layer.replaceChildren();},get editingPath(){return drag?.from??null;},destroy(){cancel();unsubscribe();root.removeEventListener('dragover',over);root.removeEventListener('drop',drop);doc.removeEventListener('keydown',escape,true);layer.remove();}};
}
