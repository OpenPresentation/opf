import {createDataContent,parseTabularData} from '@openpresentation/opf/data';
import {renderSvg} from '@openpresentation/opf-render/svg';

export function installDataControls({editor,getCanvas,getSlideIndex,getSelectedPath,setSlideIndex,status,renderOptions}) {
 const button=document.createElement('button');button.id='import-data';button.textContent='Import data';button.className='quiet';
 document.querySelector('.header-actions').prepend(button);
 const dialog=document.createElement('dialog');dialog.id='data-dialog';dialog.setAttribute('aria-labelledby','data-title');
 dialog.innerHTML=`<div class="dialog-header"><div><h2 id="data-title">Import data</h2><p>Paste CSV or JSON, or choose a file. Create an editable table or chart.</p></div><button id="data-close" aria-label="Close data import">×</button></div>
 <div class="data-split"><div class="data-inputs">
 <label>CSV, TSV, or JSON file<input id="data-file" type="file" accept=".csv,.tsv,.json,text/csv,application/json"></label>
 <label>Data<textarea id="data-text" spellcheck="false" placeholder="Quarter,Revenue&#10;Q1,12&#10;Q2,18"></textarea></label>
 <div class="copy-options"><label>Format<select id="data-format"><option value="csv">CSV</option><option value="tsv">TSV</option><option value="json">JSON</option></select></label><label>Import as<select id="data-as"><option value="table">Table</option><option value="chart">Chart</option></select></label></div>
 <label id="data-header-label"><input id="data-header" type="checkbox" checked> First row contains column names (CSV / row arrays)</label>
 <label>Slide title<input id="data-slide-title" value="Imported data"></label>
 <div id="data-chart-options" hidden><label>Chart type<select id="data-chart-type"><option value="column">Column</option><option value="bar">Bar</option><option value="line">Line</option><option value="area">Area</option><option value="pie">Pie</option><option value="donut">Donut</option></select></label><label>Category column<select id="data-category"></select></label><fieldset><legend>Numeric series</legend><div id="data-series"></div></fieldset></div>
 <label>Destination<select id="data-destination"><option value="insert">New slide after current slide</option><option value="selection">Replace selected table or chart</option></select></label>
 </div><div class="data-review"><div id="data-preview" aria-label="Data slide preview"></div><p id="data-summary" role="status"></p><p id="data-error" role="alert"></p><div id="data-grid"></div></div></div>
 <div class="dialog-footer"><span>Imports are embedded in OPF and can be undone.</span><button id="data-apply" class="primary" disabled>Import data</button></div>`;
 document.body.append(dialog); const $=id=>dialog.querySelector('#'+id);
 let content,revision=0,columnsKey='';
 const options=()=>({format:$('data-format').value,header:$('data-header').checked});
 function selectedTarget() {
   const parts=String(getSelectedPath()).replace(/^\//,'').split(/[./]/),at=parts.findIndex(p=>p==='table'||p==='chart');
   if(at<0)throw new Error('Select an existing table or chart on the slide first.');
   const type=parts[at];if(type!==$('data-as').value)throw new Error(`Selected content is a ${type}. Change Import as to ${type}, or insert a new slide.`);
   return '/'+parts.slice(0,at+1).join('/');
 }
 function prepare() {
   if(!content)throw new Error('Choose valid data first.');
   const deck=editor.document;
   if($('data-destination').value==='selection') {
     const path=selectedTarget();
     return {slideIndex:getSlideIndex(),patch:[{op:'replace',path,value:content[$('data-as').value]}]};
   }
   const index=Math.min(getSlideIndex()+1,deck.slides.length);
   return {slideIndex:index,patch:[{op:'add',path:`/slides/${index}`,value:{id:`data-${crypto.randomUUID()}`,title:$('data-slide-title').value,...content}}]};
 }
 function update() {
  content=undefined;$('data-apply').disabled=true;$('data-error').textContent='';$('data-preview').replaceChildren();$('data-grid').replaceChildren();$('data-summary').textContent='';
  $('data-chart-options').hidden=$('data-as').value!=='chart';
  try {
   if(!$('data-text').value.trim())return;
   const data=parseTabularData($('data-text').value,options()),key=JSON.stringify(data.columns);
   if(columnsKey!==key){columnsKey=key;$('data-category').replaceChildren(...data.columns.map(name=>new Option(name,name)));$('data-series').replaceChildren(...data.columns.map((name,i)=>{const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=name;input.checked=i>0;label.append(input,document.createTextNode(name));input.onchange=update;return label;}));}
   content=createDataContent($('data-text').value,{...options(),as:$('data-as').value,chartType:$('data-chart-type').value,category:$('data-category').value,series:[...$('data-series').querySelectorAll('input:checked')].map(input=>input.value)});
   // A one-slide draft inherits deck design/assets for an accurate content preview.
   const deck=editor.document, preview={...deck,slides:[{title:$('data-slide-title').value,...content}]};
   $('data-preview').innerHTML=renderSvg(preview,{...renderOptions,slideIndex:0,trace:false});
   const table=document.createElement('table');
   for(const [i,row]of [data.columns,...data.rows.slice(0,8)].entries()){const tr=document.createElement('tr');for(const value of row){const td=document.createElement(i?'td':'th');td.textContent=value===null?'—':String(value);tr.append(td);}table.append(tr);}
   $('data-grid').append(table);$('data-summary').textContent=`${data.rows.length} rows · ${data.columns.length} columns${data.rows.length>8?' · first 8 rows shown below':''}`;
   prepare();$('data-apply').disabled=false;
  }catch(error){content=undefined;$('data-error').textContent=error.message;}
 }
 button.onclick=()=>{if(getCanvas()&&!getCanvas().commit())return;dialog.showModal();update();$('data-text').focus();};
 $('data-close').onclick=()=>dialog.close();dialog.onclose=()=>{if(!dialog.open)revision++;};
 $('data-text').oninput=()=>{revision++;update();};
 for(const id of ['data-format','data-as','data-header','data-chart-type','data-destination'])$(id).onchange=update;
 $('data-slide-title').oninput=update;
 $('data-category').onchange=()=>{for(const input of $('data-series').querySelectorAll('input'))input.checked=input.value!==$('data-category').value;update();};
 $('data-file').onchange=async()=>{const file=$('data-file').files[0],request=++revision;if(!file)return;try{if(file.size>10*1024*1024)throw new Error('Choose a data file under 10 MB.');const text=await file.text();if(request!==revision)return;$('data-format').value=/\.json$/i.test(file.name)?'json':/\.tsv$/i.test(file.name)?'tsv':'csv';$('data-text').value=text;update();}catch(error){content=undefined;$('data-apply').disabled=true;$('data-error').textContent=error.message;}};
 $('data-apply').onclick=()=>{try{if(getCanvas()&&!getCanvas().commit())return;update();const result=prepare(),before=getSlideIndex();setSlideIndex(result.slideIndex);try{editor.applyPatch(result.patch,{label:'Import data'});}catch(error){setSlideIndex(before);throw error;}dialog.close();status('Data imported · Undo restores the previous document');}catch(error){$('data-error').textContent=error.message;}};
 return {destroy(){revision++;button.remove();dialog.remove();}};
}
