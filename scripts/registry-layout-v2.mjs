import assert from 'node:assert/strict';

export function verifyV2LayoutChoices({gallery,previews,validate,editor}) {
 const expected='cover section agenda statement closing text list quote two-column pillars comparison process timeline faq metrics scorecard image image-beside gallery chart chart-beside table table-beside code hero dashboard team logos'.split(' ');
 const ids=Object.keys(gallery.layouts);assert.deepEqual(ids,expected,'gallery2 canonical intent layout set and order');assert.equal(ids.length,28,'complete gallery2 layout set');
 assert.deepEqual(Object.keys(previews.layoutPreviews).sort(),ids.toSorted(),'preview ownership/key set');
 assert.deepEqual(previews.layoutPreviewIndex.records.map(r=>r.id),ids,'preview/catalog order');
 const slide={layout:'text',title:'Keep title',subtitle:'Keep subtitle',notes:'Keep notes',blocks:[{text:'Keep supporting text'},{metric:{value:'42',label:'Keep metric'}},{quote:{text:'Keep quote',attribution:'Keep author'}}]};
 const original=JSON.stringify({slides:[slide]},null,2);
 const context=editor.getJsonFieldContext(original,original.indexOf('"layout"')+1,[gallery]);
 assert.ok(context,'layout context exists');
 const owned=context.options.filter(option=>option.source==='Loaded catalog');
 assert.deepEqual(owned.map(o=>o.value).toSorted(),ids.toSorted(),'all28 registered choices, no aliases');
 for(const id of ids){
  const option=owned.find(o=>o.value===id);assert.equal(option.label,gallery.layouts[id].name,id);
  assert.equal(option.sourceLabel,'Provided by app',id);assert.ok(option.regions?.length,id+' region summary');
  assert.equal(previews.getLayoutPreview(id),previews.layoutPreviews[id],id+' accessor must return canonical preview bytes');
  assert.match(previews.getLayoutPreview(id),/^<svg\b/,id+' actual preview');assert.equal(previews.hasLayoutPreview(id),true,id);
  assert.equal(Buffer.byteLength(previews.getLayoutPreview(id)+'\n'),previews.layoutPreviewIndex.records.find(r=>r.id===id).bytes,id+' preview bytes');
  const result=editor.replaceFieldOption(context,id),edit=editor.fieldOptionEdit(context,id);
  assert.equal(original.slice(0,edit.from)+edit.insert+original.slice(edit.to),result,id+' exact edit application');
  const document=JSON.parse(result);assert.deepEqual(document,{slides:[{...slide,layout:id}]},id+' preserves all authored fields, order and values');
  const checked=validate(document,{catalogs:[gallery],only:['format','references']});assert.equal(checked.valid,true,id+': '+JSON.stringify(checked.findings));
 }
 return {choices:ids.length,previews:ids.length,contentPreserved:true};
}
