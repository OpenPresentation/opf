import { applyJsonPatch, createValuePatch, getValueAtPath, opfPathToJsonPointer, splitOpfPath, validateOpfDocument } from './index.js';
import { schemaAtPath, schemaVariants, activeSchema, schemaType, schemaLabel, createSchemaValue } from './schema.js';
/** A staged form editor; valid drafts preview immediately and Apply creates one undo step. */
export function createSchemaInspector(container, {editor,path='',onDraft,onCommit,onCancel,onError}={}) {
  if(!editor)throw new Error('An editor session is required.');
  let base=JSON.stringify(editor.document), draft=structuredClone(editor.document), selected=opfPathToJsonPointer(path), dirty=false, destroyed=false, suppress=false;
  const doc=container.ownerDocument;
  const el=(tag,text,cls)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
  const button=(text,action)=>{const node=el('button',text);node.type='button';node.onclick=()=>{try{action();}catch(error){showError(error.message);onError?.(error);}};return node;};
  const input=(label,value,change,type='text')=>{const wrap=el('label',undefined,'opf-schema-field'),caption=el('span',label);const control=el(type==='textarea'?'textarea':'input');if(type!=='textarea')control.type=type;control.value=String(value??'');control.setAttribute('aria-label',label);control.oninput=()=>change(control.value,control);wrap.append(caption,control);return wrap;};
  const errorBox=el('p',undefined,'opf-schema-error');errorBox.setAttribute('role','alert');
  const status=el('p',undefined,'opf-schema-status');status.setAttribute('role','status');
  const body=el('div',undefined,'opf-schema-body'),nav=el('nav',undefined,'opf-schema-breadcrumbs');nav.setAttribute('aria-label','OPF field location');
  const actions=el('div',undefined,'opf-schema-actions');const apply=button('Apply changes',commit),cancel=button('Discard draft',reset);actions.append(status,apply,cancel);
  container.replaceChildren(nav,body,errorBox,actions);container.classList.add('opf-schema-inspector');
  function showError(message){errorBox.textContent=message;}
  function check(){
    const validation=validateOpfDocument(draft);
    apply.disabled=!dirty||!validation.valid;
    status.textContent=dirty?'Draft changes · apply to save':'No pending changes';
    showError(validation.valid?'':validation.errors.slice(0,3).map(error=>`${error.path||'/'}: ${error.message}`).join('\n'));
    if(validation.valid)try{onDraft?.({document:structuredClone(draft),path:selected,dirty});}catch(error){showError(`Preview: ${error.message}`);onError?.(error);}
  }
  function mutate(operations,redraw=true){draft=applyJsonPatch(draft,operations);dirty=JSON.stringify(draft)!==base;if(redraw)render();check();}
  function set(path,value,redraw=true){mutate(createValuePatch(draft,path,value),redraw);}
  function navigate(path){selected=opfPathToJsonPointer(path);render();check();}
  function reset(){base=JSON.stringify(editor.document);draft=structuredClone(editor.document);dirty=false;render();check();onCancel?.();}
  function commit(){
    if(!dirty)return true;
    if(JSON.stringify(editor.document)!==base){showError('The document changed elsewhere. Discard this draft and reopen the field to avoid overwriting newer changes.');return false;}
    const result=validateOpfDocument(draft);if(!result.valid){check();return false;}
    suppress=true;
    try{editor.applyPatch([{op:'replace',path:'',value:draft}],{source:'schema-inspector',rejectInvalid:true});base=JSON.stringify(editor.document);draft=structuredClone(editor.document);dirty=false;render();check();onCommit?.({editor,path:selected});return true;}finally{suppress=false;}
  }
  function summary(value){return Array.isArray(value)?`${value.length} items`:value&&typeof value==='object'?`${Object.keys(value).length} fields`:String(value??'').slice(0,80);}
  function render(){
    if(destroyed)return;
    if(getValueAtPath(draft,selected)===undefined) selected='';
    const parts=splitOpfPath(selected), value=getValueAtPath(draft,selected), raw=schemaAtPath(draft,selected), variants=schemaVariants(raw), schema=activeSchema(raw,value), type=schemaType(schema,value);
    nav.replaceChildren(button('Presentation',()=>navigate('')));
    parts.forEach((part,index)=>nav.append(el('span','/'),button(/^\d+$/.test(part)?String(Number(part)+1):part,()=>navigate(parts.slice(0,index+1)))));
    body.replaceChildren(el('h3',parts[0]==='slides'&&parts.length===2?`Slide ${Number(parts[1])+1}`:parts.at(-1)??'Presentation'));
    if(schema.description)body.append(el('p',schema.description,'opf-schema-description'));
    if(variants.length>1 || Object.keys(raw).length===0){
      const choices=variants.length>1?variants:[{type:'string'},{type:'number'},{type:'boolean'},{type:'object'},{type:'array'},{type:'null'}];
      const label=el('label','Value form'), select=el('select');select.setAttribute('aria-label','Value form');
      choices.forEach((variant,index)=>{const option=el('option',schemaLabel(variant,index));option.value=String(index);select.append(option);});
      const current=choices.findIndex(item=>item===schema||JSON.stringify(item)===JSON.stringify(schema));select.value=String(Math.max(0,current>=0?current:choices.findIndex(item=>schemaType(item,value)===(Array.isArray(value)?'array':value===null?'null':typeof value))));
      select.onchange=()=>{try{set(selected,createSchemaValue(choices[Number(select.value)]));}catch(error){showError(error.message);}};label.append(select);body.append(label);
    }
    if(type==='object' && value!==null && !Array.isArray(value)){
      const search=input('Find a field','',text=>{for(const row of rows.children)row.hidden=!row.textContent.toLowerCase().includes(text.toLowerCase());},'search');body.append(search);
      const rows=el('div',undefined,'opf-schema-rows');
      const properties={...schema.properties};for(const key of Object.keys(value))properties[key]??={};
      for(const [key,fieldSchema]of Object.entries(properties)){
        const present=Object.prototype.hasOwnProperty.call(value,key), required=(schema.required??[]).includes(key), fieldPath=opfPathToJsonPointer([...parts,key]);
        const row=el('div',undefined,'opf-schema-row'),name=el('div');name.append(el('strong',key+(required?' *':'')),el('small',present?summary(value[key]):'Not set'));
        const help=fieldSchema.description??'';row.title=help;
        const controls=el('div');controls.append(button(present?'Edit':'Add',()=>{if(!present)set(fieldPath,createSchemaValue(fieldSchema));navigate(fieldPath);}));
        if(present&&!required)controls.append(button('Remove',()=>mutate([{op:'remove',path:fieldPath}])));
        for(const control of controls.children)control.setAttribute('aria-label',`${control.textContent} ${key}`);
        row.append(name,controls);rows.append(row);
      }
      body.append(rows);
      if(schema.additionalProperties!==false){
        let newKey='';body.append(input('New field name','',value=>{newKey=value;}),button('Add named field',()=>{
          if(!newKey.trim()||['__proto__','constructor','prototype'].includes(newKey))throw new Error('Enter a safe, nonempty field name.');
          if(Object.prototype.hasOwnProperty.call(value,newKey))throw new Error('That field already exists.');
          const keySchema=Object.entries(schema.patternProperties??{}).find(([pattern])=>new RegExp(pattern).test(newKey))?.[1]??schema.additionalProperties;
          const next=opfPathToJsonPointer([...parts,newKey]);set(next,createSchemaValue(typeof keySchema==='object'?keySchema:{}));navigate(next);
        }));
      }
    }else if(type==='array' && Array.isArray(value)){
      value.forEach((item,index)=>{
        const row=el('div',undefined,'opf-schema-row'), itemPath=opfPathToJsonPointer([...parts,String(index)]),controls=el('div');
        row.append(el('span',`${index+1}. ${summary(item)}`));controls.append(button('Edit',()=>navigate(itemPath)),button('Duplicate',()=>mutate([{op:'add',path:opfPathToJsonPointer([...parts,String(index+1)]),value:item}])));
        if(index>0)controls.append(button('Move up',()=>{const next=[...value];[next[index-1],next[index]]=[next[index],next[index-1]];set(selected,next);}));
        if(index<value.length-1)controls.append(button('Move down',()=>{const next=[...value];[next[index+1],next[index]]=[next[index],next[index+1]];set(selected,next);}));
        if(value.length>(schema.minItems??0))controls.append(button('Remove',()=>mutate([{op:'remove',path:itemPath}])));
        row.append(controls);body.append(row);
      });
      const add=button('Add item',()=>{const itemPath=opfPathToJsonPointer([...parts,String(value.length)]), itemSchema=schemaAtPath(draft,itemPath);set(itemPath,createSchemaValue(itemSchema));navigate(itemPath);});add.disabled=value.length>=(schema.maxItems??10000);body.append(add);
    }else if(schema.enum || Object.prototype.hasOwnProperty.call(schema,'const')){
      const label=el('label','Value'),select=el('select');select.setAttribute('aria-label','Value');
      (schema.enum??[schema.const]).forEach(item=>{const option=el('option',String(item));option.value=JSON.stringify(item);select.append(option);});select.value=JSON.stringify(value);select.disabled=schema.const!==undefined;select.onchange=()=>set(selected,JSON.parse(select.value),false);label.append(select);body.append(label);
    }else if(type==='boolean'){
      const label=el('label'),control=el('input');control.type='checkbox';control.checked=value;control.setAttribute('aria-label',parts.at(-1)??'Value');control.onchange=()=>set(selected,control.checked,false);label.append(control,el('span','Enabled'));body.append(label);
    }else if(type==='null')body.append(el('p','Null value'));
    else {
      const numeric=type==='number'||type==='integer';
      body.append(input('Value',value,(text,control)=>{
        if(numeric && (!text.trim()||!Number.isFinite(Number(text)))){control.setAttribute('aria-invalid','true');apply.disabled=true;showError('Enter a finite number.');return;}
        control.removeAttribute('aria-invalid');set(selected,numeric?Number(text):text,false);
      },numeric?'number':'textarea'));
    }
  }
  const unsubscribe=editor.subscribe(()=>{if(suppress)return;if(dirty){showError('The document changed elsewhere. Discard the draft to load the latest version.');apply.disabled=true;}else reset();});
  render();check();
  return {navigate,commit,reset,get document(){return structuredClone(draft);},get dirty(){return dirty;},destroy(){destroyed=true;unsubscribe();container.replaceChildren();}};
}
