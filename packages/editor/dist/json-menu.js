import {getJsonFieldContext,replaceFieldOption} from './json-options.js';
let nextMenuId=0;

/** Optional DOM menu; hosts may provide their own onOptions renderer instead. */
export function mountJsonFieldMenu(parent,api,catalogs,left,top,onClose){
  const doc=parent.ownerDocument,win=doc.defaultView,source=api.getValue(),selection=api.getSelection();
  const context=getJsonFieldContext(source,selection[0],catalogs);
  if(!context)return null;
  const coordinates=api.coordinates();left??=coordinates.left;top??=coordinates.top;
  const root=doc.createElement('div');root.className='json-field-menu';root.setAttribute('role','dialog');root.setAttribute('aria-label',`${context.label} options`);
  root.style.cssText='position:fixed;z-index:10000;width:380px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;box-sizing:border-box;padding:12px;background:Canvas;color:CanvasText;border:1px solid GrayText;border-radius:8px;font:13px system-ui;box-shadow:0 8px 28px #0003';
  const add=(tag,text,className,container=root)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;container.append(node);return node;};
  const heading=add('div',undefined,'json-field-heading');add('strong',context.label,undefined,heading);
  const closeButton=add('button','×',undefined,heading);closeButton.type='button';closeButton.setAttribute('aria-label','Close options');
  const search=add('input');search.type='search';search.placeholder='Search options…';search.autocomplete='off';search.setAttribute('role','combobox');search.setAttribute('aria-label',`Search ${context.label} options`);search.setAttribute('aria-expanded','true');
  const isLayout=context.catalog==='layouts',relatedCount=context.options.filter(option=>option.related).length;
  let similar=isLayout&&relatedCount>1;
  const filters=isLayout?add('div',undefined,'json-field-filters'):null;
  const similarButton=filters?add('button',`Similar (${relatedCount})`,undefined,filters):null;
  const allButton=filters?add('button',`All layouts (${context.options.length})`,undefined,filters):null;
  for(const button of [similarButton,allButton].filter(Boolean)){button.type='button';button.style.cssText='padding:6px;margin:4px 4px 4px 0';}
  if(isLayout){search.placeholder='Search all layouts or placeholders…';add('p','Same types and counts first. Text and subtitle slots are compatible.','json-field-hint');}
  const list=add('div',undefined,'json-field-options');list.setAttribute('role','listbox');list.setAttribute('aria-label',`Available ${context.label} options`);
  let id;do{id=`opf-json-options-${++nextMenuId}`;}while(doc.getElementById(id));
  list.id=id;search.setAttribute('aria-controls',id);list.style.cssText='max-height:280px;overflow:auto;margin-top:8px';
  const error=add('p',undefined,'json-field-empty');error.setAttribute('role','alert');error.hidden=true;
  if(isLayout){
    const help=add('details',undefined,'json-field-catalog-help');add('summary','Where do these layouts come from?',undefined,help);
    add('p','Standard OPF: included with OPF. Provided by app: extra records supplied by the host app. In this document: records in your JSON, which override matching IDs. External galleries are not automatically loaded.',undefined,help);
  }
  add('p',context.unloadedSource?'Using available records. External catalog URLs are not loaded here.':'Choose an option or press Escape to keep editing JSON.','json-field-footnote');
  let selected=Math.max(0,context.options.findIndex(option=>option.value===context.value)),choices=[],disposed=false;
  function close(restore=false){if(disposed)return;disposed=true;observer.disconnect();root.remove();doc.removeEventListener('pointerdown',outside);doc.removeEventListener('wheel',outside,true);doc.removeEventListener('touchmove',outside,true);win.removeEventListener('resize',resize);onClose();if(restore){api.focus();api.setSelection(...selection);}}
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
    const active=list.querySelector(`[data-option-index="${selected}"]`);if(active?.getAttribute('role')==='option'){search.setAttribute('aria-activedescendant',active.id);active.scrollIntoView({block:'nearest'});}else search.removeAttribute('aria-activedescendant');
  }
  function render(){
    const query=search.value.trim().toLowerCase();
    choices=context.options.filter(option=>query?`${option.label} ${option.value} ${option.description??''} ${option.placeholders??''}`.toLowerCase().includes(query):!similar||option.related);
    similarButton?.setAttribute('aria-pressed',String(similar&&!query));allButton?.setAttribute('aria-pressed',String(!similar||Boolean(query)));
    for(const button of [similarButton,allButton].filter(Boolean))button.style.outline=button.getAttribute('aria-pressed')==='true'?'2px solid Highlight':'';
    list.replaceChildren();let group,container=list;
    for(const [index,option] of choices.entries()){
      if(isLayout&&option.layoutGroup!==group){group=option.layoutGroup;container=add('div',undefined,undefined,list);container.setAttribute('role','group');container.setAttribute('aria-label',group);const label=add('div',group,'json-field-group',container);label.setAttribute('aria-hidden','true');label.style.cssText='font-size:11px;font-weight:600;padding:8px 8px 4px;color:GrayText';}
      const button=add('button',undefined,undefined,container);button.dataset.optionIndex=String(index);button.type='button';button.tabIndex=-1;button.id=`${id}-${index}`;button.setAttribute('role','option');button.setAttribute('aria-selected',String(option.value===context.value));button.style.cssText='display:block;text-align:left;width:100%;padding:8px;border:0;background:transparent;color:inherit';
      const label=add('span',undefined,undefined,button);add('strong',option.label,undefined,label);if(option.value===context.value)add('span',' ✓',undefined,label);
      if(option.placeholders){const summary=add('div',option.placeholders,'json-field-placeholders',button);summary.style.cssText='margin:4px 0';}
      const meta=add('div',undefined,'json-field-meta',button);meta.style.cssText='display:flex;gap:12px;justify-content:space-between;flex-wrap:wrap';
      add('code',String(option.value),undefined,meta);const origin=add('small',option.sourceLabel??option.source,undefined,meta);origin.title=option.sourceDescription??'';
      if(option.description)add('p',option.description,undefined,button);
      button.addEventListener('mouseenter',()=>{selected=index;highlight();});button.addEventListener('click',()=>choose(option));
    }
    if(!choices.length)add('p','No matching options. You can still type a custom value in the JSON.','json-field-empty',list);
    if(similar&&!query&&relatedCount===1)add('p','No other available layouts share these placeholders. Try All layouts.','json-field-empty',list);
    highlight();
  }
  search.addEventListener('input',()=>{selected=0;render();});
  similarButton?.addEventListener('click',()=>{similar=true;search.value='';selected=0;render();});
  allButton?.addEventListener('click',()=>{similar=false;search.value='';selected=0;render();});
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}
    else if(event.target===search&&['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();selected=Math.max(0,Math.min(choices.length-1,selected+(event.key==='ArrowDown'?1:-1)));highlight();}
    else if(event.target===search&&event.key==='Enter'&&choices[selected]){event.preventDefault();choose(choices[selected]);}
  });
  root.addEventListener('focusout',event=>{if(event.relatedTarget&&!root.contains(event.relatedTarget))close();});
  closeButton.addEventListener('click',()=>close(true));doc.body.append(root);render();
  function reposition(){const box=root.getBoundingClientRect();root.style.left=`${Math.max(8,Math.min(left,win.innerWidth-box.width-8))}px`;root.style.top=`${Math.max(8,Math.min(top,win.innerHeight-box.height-8))}px`;}
  const observer=new win.ResizeObserver(reposition);observer.observe(root);reposition();
  search.focus();doc.addEventListener('pointerdown',outside);doc.addEventListener('wheel',outside,{capture:true,passive:true});doc.addEventListener('touchmove',outside,{capture:true,passive:true});win.addEventListener('resize',resize);
  return {destroy:()=>close()};
}
