import {getJsonFieldContext,replaceFieldOption} from './json-options.js';
let nextMenuId=0;

/** Optional DOM menu; hosts may provide their own onOptions renderer instead. */
export function mountJsonFieldMenu(parent,api,catalogs,left,top,onClose){
  const doc=parent.ownerDocument,win=doc.defaultView,source=api.getValue(),selection=api.getSelection();
  const context=getJsonFieldContext(source,selection[0],catalogs);
  if(!context)return null;
  const coordinates=api.coordinates();left??=coordinates.left;top??=coordinates.top;
  const root=doc.createElement('div');root.className='json-field-menu';root.setAttribute('role','dialog');root.setAttribute('aria-label',`${context.label} options`);
  root.style.cssText='position:fixed;z-index:10000;width:320px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;box-sizing:border-box;padding:12px;background:Canvas;color:CanvasText;border:1px solid GrayText;border-radius:8px;font:13px system-ui;box-shadow:0 8px 28px #0003';
  const add=(tag,text,className,container=root)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;container.append(node);return node;};
  const heading=add('div',undefined,'json-field-heading');add('strong',context.label,undefined,heading);
  const closeButton=add('button','×',undefined,heading);closeButton.type='button';closeButton.setAttribute('aria-label','Close options');
  const search=add('input');search.type='search';search.placeholder='Search options…';search.autocomplete='off';search.setAttribute('role','combobox');search.setAttribute('aria-label',`Search ${context.label} options`);search.setAttribute('aria-expanded','true');
  const list=add('div',undefined,'json-field-options');list.setAttribute('role','listbox');list.setAttribute('aria-label',`Available ${context.label} options`);
  let id;do{id=`opf-json-options-${++nextMenuId}`;}while(doc.getElementById(id));
  list.id=id;search.setAttribute('aria-controls',id);list.style.cssText='max-height:280px;overflow:auto;margin-top:8px';
  const error=add('p',undefined,'json-field-empty');error.setAttribute('role','alert');error.hidden=true;
  add('p',context.unloadedSource?'Using included and built-in records. External catalog URLs are not loaded here.':'Choose an option or press Escape to keep editing JSON.','json-field-footnote');
  let selected=Math.max(0,context.options.findIndex(option=>option.value===context.value)),choices=context.options,disposed=false;
  function close(restore=false){if(disposed)return;disposed=true;root.remove();doc.removeEventListener('pointerdown',outside);doc.removeEventListener('wheel',outside,true);doc.removeEventListener('touchmove',outside,true);win.removeEventListener('resize',resize);onClose();if(restore){api.focus();api.setSelection(...selection);}}
  function outside(event){if(!root.contains(event.target))close();}
  function resize(){close();}
  function choose(option){
    if(api.getValue()!==source){close();return;}
    try{replaceFieldOption(context,option.value);api.replace(context.offset,context.offset+context.length,JSON.stringify(option.value));close();api.focus();}
    catch(cause){error.hidden=false;error.textContent=cause.message;}
  }
  function highlight(){
    for(const [index,node] of [...list.querySelectorAll('[role="option"]')].entries()){
      node.classList.toggle('is-highlighted',index===selected);node.style.outline=index===selected?'2px solid Highlight':'';
    }
    const active=list.children[selected];if(active?.getAttribute('role')==='option'){search.setAttribute('aria-activedescendant',active.id);active.scrollIntoView({block:'nearest'});}else search.removeAttribute('aria-activedescendant');
  }
  function render(){
    list.replaceChildren();
    for(const [index,option] of choices.entries()){
      const button=add('button',undefined,undefined,list);button.type='button';button.tabIndex=-1;button.id=`${id}-${index}`;button.setAttribute('role','option');button.setAttribute('aria-selected',String(option.value===context.value));button.style.cssText='display:block;text-align:left;width:100%;padding:8px;border:0;background:transparent;color:inherit';
      const label=add('span',undefined,undefined,button);add('strong',option.label,undefined,label);if(option.value===context.value)add('span',' ✓',undefined,label);
      add('code',String(option.value),undefined,button);add('small',`${option.source}${option.suggested?' · Suggested for this slide':''}`,undefined,button);
      if(option.description)add('p',option.description,undefined,button);
      button.addEventListener('mouseenter',()=>{selected=index;highlight();});button.addEventListener('click',()=>choose(option));
    }
    if(!choices.length)add('p','No matching options. You can still type a custom value in the JSON.','json-field-empty',list);
    highlight();
  }
  search.addEventListener('input',()=>{const query=search.value.toLowerCase();choices=context.options.filter(option=>`${option.label} ${option.value} ${option.description??''}`.toLowerCase().includes(query));selected=0;render();});
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}
    else if(event.target===search&&['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();selected=Math.max(0,Math.min(choices.length-1,selected+(event.key==='ArrowDown'?1:-1)));highlight();}
    else if(event.target===search&&event.key==='Enter'&&choices[selected]){event.preventDefault();choose(choices[selected]);}
  });
  root.addEventListener('focusout',event=>{if(event.relatedTarget&&!root.contains(event.relatedTarget))close();});
  closeButton.addEventListener('click',()=>close(true));doc.body.append(root);render();
  const box=root.getBoundingClientRect();root.style.left=`${Math.max(8,Math.min(left,win.innerWidth-box.width-8))}px`;root.style.top=`${Math.max(8,Math.min(top,win.innerHeight-box.height-8))}px`;
  search.focus();doc.addEventListener('pointerdown',outside);doc.addEventListener('wheel',outside,{capture:true,passive:true});doc.addEventListener('touchmove',outside,{capture:true,passive:true});win.addEventListener('resize',resize);
  return {destroy:()=>close()};
}
