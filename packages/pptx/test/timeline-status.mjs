// FA-11: TimelineEvent.status in the PPTX export and import. done and unset are a native filled ellipse, current adds a
// ring (a second ellipse) and a bold label, planned is an outlined ellipse over the background with muted text, and
// import restores the status from the marker tags (the ring is validated against it).
import assert from 'node:assert/strict';
import {unzipSync,zipSync} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {colorContrast} from '@openpresentation/opf/composition';
import {toPptx, fromPptx, resolvePresentation} from './helpers/default-catalog.mjs';
import {loadFonts} from '@openpresentation/opf-render/fonts-node';
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false}),decode=bytes=>new TextDecoder().decode(bytes),encode=text=>new TextEncoder().encode(text),array=v=>v===undefined?[]:Array.isArray(v)?v:[v];
const fontOptions={fonts:await loadFonts()};
const events=[{when:'Q1',what:'Discovery',description:'Interviews.'},{when:'Q2',what:'Pilot'},{when:'Q3',what:'Rollout'},{what:'Review'}];
const withStatus=(...statuses)=>events.map((event,i)=>statuses[i]?{...event,status:statuses[i]}:{...event});
const deckOf=timeline=>({design:{fontScheme:'roboto'},slides:[{title:'Roadmap',composition:{minFontSize:24,overflow:'error'},timeline}]});
const shapesOf=async(deck,options)=>{
  const bytes=await toPptx(deck,options),entries=unzipSync(bytes),xml=decode(entries['ppt/slides/slide1.xml']);
  const tree=parser.parse(xml)['p:sld']['p:cSld']['p:spTree'];
  return {bytes,entries,xml,shapes:array(tree['p:sp']).filter(shape=>shape['p:nvSpPr']?.['p:cNvPr']?.name.startsWith('OPF timeline '))};
};
const outlined=shape=>{const color=shape['p:spPr']['a:ln']?.['a:solidFill']?.['a:srgbClr'];return color!==undefined&&color['a:alpha']===undefined;};
const named=(shapes,pattern)=>shapes.filter(shape=>pattern.test(shape['p:nvSpPr']['p:cNvPr'].name));

for(const options of [{},fontOptions]){
  // No status: the plain filled markers and no ring shapes, exactly as before.
  const plain=await shapesOf(deckOf(events),options);
  assert.equal(named(plain.shapes,/ ring /).length,0);
  for(const marker of named(plain.shapes,/ marker \d+$/))assert.ok(marker['p:spPr']['a:solidFill']&&!outlined(marker));
  assert.deepEqual((await fromPptx(plain.bytes)).slides[0].timeline,events);

  const timeline=withStatus('done','current','planned');
  const deck=deckOf(timeline),{bytes,shapes,entries,xml}=await shapesOf(deck,options);
  const bound=resolvePresentation(deck,options).slides[0],layout=bound.geometry.items.find(item=>item.timelineLayout).timelineLayout;
  const background=bound.design.backgroundColor??bound.design.colors.background;
  assert.deepEqual(layout.markers.map(marker=>marker.status),['done','current','planned',undefined]);
  const markers=named(shapes,/ marker \d+$/),rings=named(shapes,/ ring \d+$/);
  assert.equal(markers.length,4);assert.equal(rings.length,1,'only the current event has a ring');
  for(const shape of [...markers,...rings])assert.equal(shape['p:spPr']['a:prstGeom'].prst,'ellipse');
  const fillOf=shape=>shape['p:spPr']['a:solidFill']?.['a:srgbClr']?.val,lineOf=shape=>shape['p:spPr']['a:ln'];
  const [done,current,planned,unset]=markers;
  assert.equal(fillOf(done),fillOf(unset));assert.equal(fillOf(current),fillOf(done));
  assert.ok(!outlined(done)&&!outlined(current)&&!outlined(unset),'done and current dots have no outline');
  assert.ok(outlined(planned)&&outlined(rings[0]));
  const bg=background.replace('#','').toUpperCase();
  assert.equal(fillOf(planned),bg);assert.equal(lineOf(planned)['a:solidFill']['a:srgbClr'].val,fillOf(done));
  assert.equal(fillOf(rings[0]),bg);assert.equal(lineOf(rings[0])['a:solidFill']['a:srgbClr'].val,fillOf(done));
  const ext=shape=>Number(shape['p:spPr']['a:xfrm']['a:ext'].cx);
  assert.equal(ext(rings[0]),1.6*ext(current),'the ring ellipse is exactly 1.6 times the dot');
  assert.equal(ext(planned),ext(done),'a hollow marker is the same size as a filled one');
  // Text: bold label for the current event, muted (>= 4.5:1) text for the planned one, the usual color elsewhere.
  const runOf=(eventIndex,field)=>{
    const part=layout.parts.findIndex(p=>p.eventIndex===eventIndex&&p.role===field);
    const shape=named(shapes,new RegExp(`part ${part} line 0$`))[0];
    return array(array(shape['p:txBody']['a:p'])[0]['a:r'])[0]['a:rPr'];
  };
  assert.equal(runOf(1,'what').b,'1');assert.notEqual(runOf(0,'what').b,'1');assert.notEqual(runOf(2,'what').b,'1');
  const plannedColor=runOf(2,'what')['a:solidFill']?.['a:srgbClr']?.val;
  assert.ok(plannedColor&&colorContrast(`#${plannedColor}`,background)>=4.5,`planned text ${plannedColor}`);
  assert.equal(runOf(2,'when')['a:solidFill']['a:srgbClr'].val,plannedColor);
  assert.notEqual(runOf(0,'what')['a:solidFill']?.['a:srgbClr']?.val,plannedColor);

  // Import restores the status.
  const diagnostics=[],imported=await fromPptx(bytes,{onDiagnostic:d=>diagnostics.push(d)});
  assert.deepEqual(imported.slides[0].timeline,timeline);
  assert.ok(diagnostics.some(d=>d.code==='timeline-import-reflow'));
  // Statuses of the object form and of every state on its own.
  for(const status of ['done','current','planned']){
    const one=[{when:'Now',what:'Only',status}];
    assert.deepEqual((await fromPptx(await toPptx(deckOf({name:'Plan',events:one}),options))).slides[0].timeline,{name:'Plan',events:one});
  }
  // Damaged status provenance falls back to ordinary text without a status.
  const rebuilt=(change)=>{const copy=structuredClone(entries);copy['ppt/slides/slide1.xml']=encode(change(xml));return fromPptx(zipSync(copy),{onDiagnostic:d=>diagnostics.push(d)});};
  const mutate=(pattern,change)=>x=>x.replace(/<p:sp>[^]*?<\/p:sp>/g,shape=>pattern.test(shape)?change(shape):shape);
  for(const [name,change] of [
    ['missing-ring',mutate(/name="OPF timeline 0 ring 1"/,()=>'')],
    ['ring-as-rect',mutate(/name="OPF timeline 0 ring 1"/,shape=>shape.replace('prst="ellipse"','prst="rect"'))],
    ['duplicate-ring',mutate(/name="OPF timeline 0 ring 1"/,shape=>shape+shape)],
  ]){
    const before=diagnostics.length,result=await rebuilt(change);
    assert.ok(diagnostics.slice(before).some(d=>d.code==='invalid-timeline-provenance'),name);
    assert.equal(result.slides[0].timeline,undefined,name);
  }
}
console.log('Timeline status passed: native ellipses for done, current (ring) and planned, bold and muted text, restored on import and three damaged-ring controls.');
