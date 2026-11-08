// Read-only review assertions over already captured literal bytes, not normalized archive hashes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
const root=process.argv[2];assert.ok(root);
const {unzipSync,strFromU8}=createRequire('C:/opf-work/integration-034/packages/pptx/package.json')('fflate');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const expectedAdded=['inverted-pyramid','org-chart','hierarchy','venn'];
const decode=bytes=>JSON.parse(Buffer.from(/val="([0-9A-F]+)"/u.exec(strFromU8(bytes))[1],'hex'));
function layouts(parts){
  return Object.entries(parts).filter(([file])=>/^ppt\/tags\/opfLayout\d+\.xml$/u.test(file)).map(([file,bytes])=>{
    const record=decode(bytes),relations=Object.entries(parts).find(([name,b])=>/^ppt\/slideLayouts\/_rels\/slideLayout\d+\.xml.rels$/u.test(name)&&strFromU8(b).includes('../tags/'+path.basename(file)));assert.ok(relations);
    return{id:record.id,record,tag:file,tagHash:hash(bytes),native:relations[0].replace('/_rels/','/').replace('.rels',''),rel:relations[0]};
  });
}
const review=[];let workbookArchives=0,workbookParts=0;
function unchangedGroup(a,b,regexp){const names=Object.keys(a).filter(file=>regexp.test(file));assert.deepEqual(Object.keys(b).filter(file=>regexp.test(file)),names);for(const name of names)assert.ok(Buffer.from(a[name]).equals(Buffer.from(b[name])),name+' unexpectedly changed');return names.length;}
function workbooks(a,b){
  const names=Object.keys(a).filter(file=>/\.xlsx$/iu.test(file));assert.deepEqual(Object.keys(b).filter(file=>/\.xlsx$/iu.test(file)),names);
  for(const name of names){assert.ok(Buffer.from(a[name]).equals(Buffer.from(b[name])));const x=unzipSync(a[name]),y=unzipSync(b[name]);assert.deepEqual(Object.keys(y),Object.keys(x));for(const file of Object.keys(x))assert.ok(Buffer.from(x[file]).equals(Buffer.from(y[file])));workbookArchives++;workbookParts+=Object.keys(x).length;}
  return names.map(file=>({file,sha256:hash(a[file]),nestedParts:Object.keys(unzipSync(a[file])).length}));
}
const nine=JSON.parse(fs.readFileSync(root+'/nine/review.json'));
for(const row of nine.entries){
  const directory=root+'/nine/'+row.name,a=unzipSync(fs.readFileSync(directory+'/before.pptx')),b=unzipSync(fs.readFileSync(directory+'/after.pptx')),old=layouts(a),current=layouts(b);
  const added=current.filter(x=>!old.some(y=>y.id===x.id));assert.deepEqual(added.map(x=>x.id),expectedAdded);
  const existing=old.map(previous=>{const next=current.find(x=>x.id===previous.id);assert.ok(next);assert.ok(Buffer.from(a[previous.tag]).equals(Buffer.from(b[next.tag])));assert.ok(Buffer.from(a[previous.native]).equals(Buffer.from(b[next.native])));return{id:previous.id,beforeTag:previous.tag,afterTag:next.tag,beforeNative:previous.native,afterNative:next.native,literalTagExact:true,literalNativeExact:true};});
  const parts=[];
  for(const change of row.parts.changed){
    const file=change.file,before=a[file]?strFromU8(a[file]):'',after=b[file]?strFromU8(b[file]):'';let reason;
    if(file==='[Content_Types].xml'||file==='ppt/slideMasters/_rels/slideMaster1.xml.rels'||file==='ppt/slideMasters/slideMaster1.xml'){
      const tokens=after.match(/<[^>]+>/gu),oldTokens=before.match(/<[^>]+>/gu);assert.equal(oldTokens.filter(t=>!tokens.includes(t)).length,0);const additions=tokens.filter(t=>!oldTokens.includes(t));
      assert.equal(additions.length,file==='[Content_Types].xml'?8:4);let reverted=after;for(const token of additions)reverted=reverted.replace(token,'');assert.equal(reverted,before,'Only literal new registration tokens may differ');
      reason={kind:'four additional layout registrations',addedRawTokens:additions};
    }else if(/^ppt\/slideLayouts\/slideLayout\d+\.xml$/u.test(file)){
      const currentLayout=current.find(x=>x.native===file);assert.ok(currentLayout);const previous=old.find(x=>x.id===currentLayout.id);
      if(previous){assert.ok(Buffer.from(a[previous.native]).equals(Buffer.from(b[file])));reason={kind:'existing native layout moved by catalog insertion',id:currentLayout.id,literalSourcePart:previous.native};}
      else{assert.ok(expectedAdded.includes(currentLayout.id));reason={kind:'new catalog native layout carrier',id:currentLayout.id,tag:currentLayout.record,placeholderNames:[...after.matchAll(/<p:cNvPr[^>]+name="([^"]*)"/gu)].map(m=>m[1]),text:[...after.matchAll(/<a:t>(.*?)<\/a:t>/gu)].map(m=>m[1])};}
    }else if(/^ppt\/tags\/opfLayout\d+\.xml$/u.test(file)){
      const next=current.find(x=>x.tag===file),previous=old.find(x=>x.id===next.id);
      if(previous){assert.ok(Buffer.from(a[previous.tag]).equals(Buffer.from(b[file])));reason={kind:'existing exact layout tag moved by insertion',id:next.id,literalSourcePart:previous.tag};}
      else{assert.ok(expectedAdded.includes(next.id));reason={kind:'new catalog layout tag',record:next.record};}
    }else if(/^ppt\/slideLayouts\/_rels\/slideLayout\d+\.xml.rels$/u.test(file)){
      const next=current.find(x=>x.rel===file),previous=old.find(x=>x.id===next.id);assert.ok(next);
      if(previous){const literal=strFromU8(a[previous.rel]).replace('../tags/'+path.basename(previous.tag),'../tags/'+path.basename(next.tag));assert.equal(literal,after);reason={kind:'existing layout relationships follow exact moved tag',id:next.id,literalSourcePart:previous.rel};}
      else{assert.ok(expectedAdded.includes(next.id));assert.equal((after.match(/<Relationship /gu)??[]).length,2);assert.ok(after.includes('Target="../slideMasters/slideMaster1.xml"'));assert.ok(after.includes('Target="../tags/'+path.basename(next.tag)+'"'));reason={kind:'new catalog layout relationships',id:next.id};}
    }else if(/^ppt\/slides\/_rels\/slide\d+\.xml.rels$/u.test(file)){
      const oldTarget=/Target="(\.\.\/slideLayouts\/slideLayout\d+\.xml)"/u.exec(before)?.[1],newTarget=/Target="(\.\.\/slideLayouts\/slideLayout\d+\.xml)"/u.exec(after)?.[1];assert.ok(oldTarget&&newTarget);
      const oldId=old.find(x=>x.native==='ppt/'+oldTarget.slice(3))?.id,newId=current.find(x=>x.native==='ppt/'+newTarget.slice(3))?.id;assert.equal(oldId,newId);assert.ok(oldId);assert.equal(before.replace(oldTarget,newTarget),after);reason={kind:'slide binds the same exact layout under its new index',id:oldId,before:oldTarget,after:newTarget};
    }else throw Error('Unreviewed nine-family part '+file);
    parts.push({file,status:change.status,...reason});
  }
  review.push({family:'nine',name:row.name,layoutCounts:{before:row.baseline.layoutParts,after:row.candidate.layoutParts},diagnosticsExact:JSON.stringify(row.baseline.diagnostics)===JSON.stringify(row.candidate.diagnostics),existingLayouts:existing,addedIds:added.map(x=>x.record),unchangedCharts:unchangedGroup(a,b,/^ppt\/charts\//u),unchangedNativeSlides:unchangedGroup(a,b,/^ppt\/slides\/slide\d+\.xml$/u),unchangedWorkbooks:workbooks(a,b),changedParts:parts});
}
const twentyOne=JSON.parse(fs.readFileSync(root+'/twenty-one-complete/review.json'));
for(const row of twentyOne.entries){
  const directory=root+'/twenty-one-complete/'+row.name,a=unzipSync(fs.readFileSync(directory+'/before.pptx')),b=unzipSync(fs.readFileSync(directory+'/after.pptx'));
  let disposition='whole archive byte-identical';const details=[];
  if(row.name==='bar'){
    assert.deepEqual(row.parts.changed.map(p=>p.file),['ppt/charts/chart1.xml']);const before=strFromU8(a['ppt/charts/chart1.xml']),after=strFromU8(b['ppt/charts/chart1.xml']);assert.equal(before.replace('<c:tickLblPos val="nextTo"/>','<c:tickLblPos val="low"/>'),after);disposition='bounded negative horizontal category-label position only';details.push({file:'ppt/charts/chart1.xml',before:'<c:tickLblPos val="nextTo"/>',after:'<c:tickLblPos val="low"/>'});
  }else if(row.name==='pie'){
    assert.deepEqual(row.parts.changed.map(p=>p.file),['[Content_Types].xml','docProps/app.xml','ppt/charts/chart1.xml','ppt/slides/_rels/slide1.xml.rels','ppt/slides/slide1.xml','ppt/tags/opfSlide1.xml','ppt/tags/opfChartMark1.xml']);
    const before=strFromU8(a['ppt/charts/chart1.xml']),after=strFromU8(b['ppt/charts/chart1.xml']);const manual='<c:layout><c:manualLayout><c:layoutTarget val="inner"/><c:xMode val="edge"/><c:yMode val="edge"/><c:x val="0.281"/><c:y val="0.0675"/><c:w val="0.3824"/><c:h val="0.865"/></c:manualLayout></c:layout>';assert.equal(before.replace('<c:layout/>',manual),after);
    assert.equal(strFromU8(a['docProps/app.xml']).replace('<Paragraphs>1</Paragraphs>','<Paragraphs>2</Paragraphs>'),strFromU8(b['docProps/app.xml']));
    const tag=decode(b['ppt/tags/opfChartMark1.xml']);assert.deepEqual(tag,{v:1,chart:'OPF chart 1',role:'hole'});
    const slideBefore=strFromU8(a['ppt/slides/slide1.xml']),slideAfter=strFromU8(b['ppt/slides/slide1.xml']);const shape=/<p:sp><p:nvSpPr><p:cNvPr id="3" name="OPF chart 1 mark under 1 hole"\/>[\s\S]*?<\/p:sp>/u.exec(slideAfter)?.[0];assert.ok(shape);assert.equal(slideAfter.replace(shape,'').replace('<p:cNvPr id="4" name="OPF chart 1"/>','<p:cNvPr id="3" name="OPF chart 1"/>'),slideBefore);
    const original=decode(a['ppt/tags/opfSlide1.xml']),next=decode(b['ppt/tags/opfSlide1.xml']);assert.deepEqual(next.content,original.content);assert.equal(next.native.background,original.native.background);assert.notEqual(next.native.structure,original.native.structure);assert.notEqual(next.native.style,original.native.style);
    for(const file of['[Content_Types].xml','ppt/slides/_rels/slide1.xml.rels']){const oldTokens=strFromU8(a[file]).match(/<[^>]+>/gu),newTokens=strFromU8(b[file]).match(/<[^>]+>/gu);assert.equal(oldTokens.filter(t=>!newTokens.includes(t)).length,0);const added=newTokens.filter(t=>!oldTokens.includes(t));assert.equal(added.length,1);assert.match(added[0],/opfChartMark1\.xml/u);assert.equal(strFromU8(b[file]).replace(added[0],''),strFromU8(a[file]));details.push({file,addedRawToken:added[0]});}
    details.push({file:'ppt/charts/chart1.xml',manualLayout:manual},{file:'ppt/slides/slide1.xml',addedRawShape:shape,otherNativeXmlExact:true},{file:'ppt/tags/opfChartMark1.xml',record:tag},{file:'ppt/tags/opfSlide1.xml',before:original,after:next},{file:'docProps/app.xml',before:'<Paragraphs>1</Paragraphs>',after:'<Paragraphs>2</Paragraphs>'});disposition='generic multi-series pie uses existing nested-ring adaptation: explicit shared plot plus background hole-underlay marker and registrations';
  }else{assert.equal(row.parts.changed.length,0);assert.equal(row.baseline,row.candidate);}
  review.push({family:'twenty-one',name:row.name,disposition,unchangedWorkbooks:workbooks(a,b),changedParts:row.parts.changed.map(p=>p.file),details});
}
const summary={baseline:'26fd4de9cee7e57f9e0620eddcad2dcef04e00e3',candidate:'513156a982397eaa0033808215fbb86dd284745b',entries:review.length,nineChangedParts:nine.entries.reduce((s,r)=>s+r.parts.changed.length,0),twentyOneChangedParts:twentyOne.entries.reduce((s,r)=>s+r.parts.changed.length,0),workbookArchivesCompared:workbookArchives,nestedWorkbookPartsCompared:workbookParts,allWorkbooksLiteralExact:true,allChangedPartsExplained:true,normalization:false,fixturePromotion:false,nativeAcceptance:false,review};
fs.writeFileSync(root+'/part-disposition.json',JSON.stringify(summary,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({...summary,review:undefined},null,2));
