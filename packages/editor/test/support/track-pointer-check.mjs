import assert from 'node:assert/strict';

// Exercise the real canvas event bridge, including its physical RTL gap.
export async function checkTrackPointers({startStudioPage,onObservation=()=>{}}) {
 const app=await startStudioPage();const{page,errors}=app;
 try{for(const language of ['en','ar']){
  const doc={language,design:{theme:'classic',fontScheme:'roboto'},slides:[{id:'pointer',title:'Pointer tracks',composition:{mode:'row',weights:[2,1],gap:.09},blocks:[{id:'a',text:'First'},{id:'b',text:'Second'}]}]};
  await page.evaluate(async document=>{window.ed?.destroy();window.ed=window.opfWs.createOpfEditor(window.makeHost(),{document,...window.base(),layout:'studio'});await window.ed.ready;},doc);
  await page.waitForFunction(()=>window.ed?.mounted&&!document.querySelector('.opf-canvas-fonts'));
  const first=page.locator('.opf-studio-box[data-key="/slides/@pointer/blocks/@a"]'),second=page.locator('.opf-studio-box[data-key="/slides/@pointer/blocks/@b"]');
  const target=await first.boundingBox();assert.ok(target);await page.mouse.click(target.x+target.width/2,target.y+target.height/2);const divider=page.locator('.opf-studio-divider').first();await divider.waitFor();
  const original=await page.evaluate(()=>window.ed.getDocument());assert.deepEqual(original.slides[0].blocks,doc.slides[0].blocks);
  const a=await first.boundingBox(),b=await second.boundingBox(),bar=await divider.boundingBox(),frame=await page.locator('.opf-studio-frame').boundingBox();
  assert.ok(a&&b&&bar&&frame);
  const expected=language==='ar'?(a.x+b.x+b.width)/2:(a.x+a.width+b.x)/2;
  assert.ok(Math.abs(bar.x+bar.width/2-expected)<2,language+': visible divider is in its actual physical gap');
  const x=bar.x+bar.width/2,y=bar.y+bar.height/2,initialDepth=await page.evaluate(()=>window.ed.session.snapshot().undoDepth);
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y);await page.mouse.up();
  assert.deepEqual(await page.evaluate(()=>window.ed.getDocument()),original,language+': a no-motion press has no source change');
  assert.equal(await page.evaluate(()=>window.ed.session.snapshot().undoDepth),initialDepth);
  const distance=frame.width*.03;await page.keyboard.down('Shift');await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+distance,y,{steps:5});await page.mouse.up();await page.keyboard.up('Shift');
  await page.waitForFunction(n=>window.ed.session.snapshot().undoDepth===n+1,initialDepth);
  const after=await divider.boundingBox(),document=await page.evaluate(()=>window.ed.getDocument());
  assert.ok(Math.abs((after.x+after.width/2-x)-distance)<2,language+': Shift pointer delta maps to the physical divider delta');
  const ratio=document.slides[0].composition.weights[0]/document.slides[0].composition.weights.reduce((p,q)=>p+q,0);
  assert.ok(language==='ar'?ratio<2/3:ratio>2/3,language+': the logical first share follows physical direction');
  assert.deepEqual(document.slides[0].blocks,doc.slides[0].blocks);
  onObservation({language,expectedDivider:expected,actualDivider:x,requestedPixels:distance,actualPixels:after.x+after.width/2-x,ratio,historySteps:1});
  await page.keyboard.press((process.platform==='darwin'?'Meta':'Control')+'+z');assert.deepEqual(await page.evaluate(()=>window.ed.getDocument()),original,language+': undo restores exact source');
 }}finally{await app.close();}
 assert.deepEqual(errors,[],'physical pointer qualification has no browser errors');
}
