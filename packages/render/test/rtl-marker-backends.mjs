// Real backend/permission controls; no golden, guessed baseline or native claim.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {Resvg} from '@resvg/resvg-js';
import {readB07Sources} from '../../../scripts/native-acceptance/b07-current-source.mjs';
import {toPng,toSvg,resolvePresentation} from '../dist/index.js';
import {loadFonts} from '../dist/fonts-node.js';
import {outlineRasterMarkers} from '../dist/raster-markers.js';
import {outlineLibrary} from '../dist/text-paths.js';
import {fsTypeOf} from '../dist/font-fstype.js';
import {parseXml,textContent} from '../dist/pdf-xml.js';
const hash=b=>createHash('sha256').update(b).digest('hex'),elements=node=>[node,...(node.children??[]).filter(n=>n.name).flatMap(elements)],near=(a,b,label)=>assert(Math.abs(a-b)<.001,`${label}: ${a} / ${b}`);
const original=readB07Sources().find(row=>row.id==='rtl-contrast-05-mixed-explicit-arabic').document,folder=new URL('../artifacts/rtl-marker-backends/',import.meta.url),scratch=await mkdtemp(path.join(tmpdir(),'opf-marker-backends-')),diagnostics=[];
const fonts=await loadFonts({pack:'office',substitutionPolicy:'visual',scripts:'auto',presentation:original});let groups=0;
const fail=(code,message)=>Object.assign(new Error(message),{code});
try{
 await mkdir(folder,{recursive:true});
 // Save actual public output BEFORE assertions so the first backend refusal or
 // paint disagreement remains useful. This image is an observation, not golden.
 const before=JSON.stringify(original),svg=toSvg(original,1,{fonts,trace:true}),png=await toPng(original,1,{fonts,onDiagnostic:issue=>diagnostics.push(issue)});
 await writeFile(new URL('case05-node.png',folder),png);await writeFile(new URL('case05.svg',folder),svg);await writeFile(new URL('diagnostics.json',folder),JSON.stringify(diagnostics,null,2)+'\n');
 const tree=parseXml(svg),marker=elements(tree).find(n=>n.name==='text'&&n.attrs['data-opf-number-marker']==='rtl'),entry=resolvePresentation(original,{fonts}).slides[0].geometry.items.find(item=>item.field==='items').text.listEntries[0],group=elements(tree).find(n=>n.name==='g'&&n.attrs['data-opf-path']===entry.textPath),body=group&&elements(group).find(n=>n.name==='text'&&n.attrs.y!==undefined);
 assert(marker&&body);assert.equal(textContent(marker),'1.');assert.equal(JSON.stringify(original),before);near(Number(marker.attrs.y),Number(body.attrs.y),'actual marker/body baseline');assert(Number(marker.attrs.y)<entry.marker.y,'genuine policy-adjusted marker no longer uses unshifted core baseline');assert.deepEqual(diagnostics,[]);
 // Independently inspect actual raster ink in the marker-only source column.
 // The period is the short connected component and the digit is the tall one;
 // neither source token nor image is reversed or transformed for this check.
 assert(Number.isFinite(entry.marker.width)&&entry.marker.width>0);const size=Number(marker.attrs['font-size']),right=Number(marker.attrs.x),baseline=Number(marker.attrs.y),left=Math.floor(right-entry.marker.width)-1,top=Math.floor(baseline-size),width=Math.ceil(entry.marker.width)+3,height=Math.ceil(size*1.1)+2;
 const {data,info}=await sharp(png).extract({left,top,width,height}).removeAlpha().raw().toBuffer({resolveWithObject:true});const pending=new Set();for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const i=(y*info.width+x)*info.channels;if(data[i]>180&&data[i+1]>180&&data[i+2]>180)pending.add(y*info.width+x);}
 const components=[];while(pending.size){const start=pending.values().next().value,queue=[start],points=[];pending.delete(start);while(queue.length){const at=queue.pop(),x=at%info.width,y=Math.floor(at/info.width);points.push([x,y]);for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){const next=ny*info.width+nx;if(nx>=0&&nx<info.width&&ny>=0&&ny<info.height&&pending.delete(next))queue.push(next);}}if(points.length>=2){const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);components.push({x:left+Math.min(...xs),right:left+Math.max(...xs),height:Math.max(...ys)-Math.min(...ys)+1,pixels:points.length});}}
 await writeFile(new URL('marker-ink.json',folder),JSON.stringify({left,top,width,height,components},null,2)+'\n');assert.equal(components.length,2,'one digit and one period with no duplicate/leftover glyph');const [period,digit]=[...components].sort((a,b)=>a.height-b.height);assert(period.height<digit.height/2);assert(period.right<digit.x,'real resvg period is left of digit');assert(Math.max(...components.map(c=>c.right))<=Math.ceil(right),'ink stays inside the same physical right edge');groups++;
 // The same shared baseline is used by numeric and text-bullet markers, in
 // measured and natural flow. LTR/no-policy coordinates retain core's value.
 for(const measured of [true,false])for(const language of ['ar-SA','en-US'])for(const numbered of [true,false]){
  const document={language,slides:[{title:'Marker baseline',items:[language==='ar-SA'?'البند: Bonjour 1':'Plain item'],...(numbered?{numbering:'arabic'}:{})}]},options={...(measured?{fonts}:{}),trace:true},s=toSvg(document,1,options),bound=resolvePresentation(document,measured?{fonts}:{}),e=bound.slides[0].geometry.items.find(item=>item.field==='items').text.listEntries[0],nodes=elements(parseXml(s)),m=nodes.find(n=>n.name==='text'&&n.attrs['aria-hidden']==='true'),g=nodes.find(n=>n.name==='g'&&n.attrs['data-opf-path']===e.textPath),b=g&&elements(g).find(n=>n.name==='text'&&n.attrs.y!==undefined);assert(m&&b);near(Number(m.attrs.y),Number(b.attrs.y),'numeric/bullet actual body baseline');if(language==='en-US')near(Number(m.attrs.y),e.marker.y,'LTR no-policy baseline unchanged');
 }
 groups++;
 // One narrow rewrite only: returned SVG stays logical/readable; body and
 // ordinary external/LTR/nonnumeric SVG are never globally outlined.
 const exact={fontFiles:fonts.registry.fontFiles,fontDirs:[],loadSystemFonts:false,defaultFontFamily:'Roboto',sansSerifFamily:'Roboto',monospaceFamily:'Roboto Mono'},limited=[];
 const outlined=await outlineRasterMarkers(svg,{font:exact,shape:fonts.outlines.shape,report:d=>limited.push(d),fail});assert.deepEqual(limited,[]);assert.match(outlined,/<g[^>]*data-opf-number-marker="rtl"/);assert.doesNotMatch(outlined,/<text[^>]*data-opf-number-marker="rtl"/);assert.equal(textContent(elements(parseXml(outlined)).find(n=>n.name==='g'&&n.attrs['data-opf-path']===entry.textPath)),textContent(group),'all body text survives temporary marker-only outlining');assert.match(svg,/>1\.<\/text>/);assert.match(outlined,/Bonjour/);
 const plain='<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><text x="20" y="50" font-family="Roboto" font-size="30">1.</text></svg>';
 const neverRead={get fontFiles(){throw Error('marker-free extra font read');},get loadSystemFonts(){throw Error('noncandidate extra font setting read');}};
 for(const noncandidate of [plain,plain.replace('<text ', '<text data-opf-number-marker="rtl" '),plain.replace('<text ', '<text data-opf-number-marker="rtl" direction="ltr" unicode-bidi="isolate" aria-hidden="true" '),plain.replace('<text ', '<g data-opf-number-marker="rtl" direction="rtl" unicode-bidi="isolate" aria-hidden="true"></g><text '),plain.replace('<text ', '<metadata data-opf-number-marker="rtl">description</metadata><text ')])assert.equal(await outlineRasterMarkers(noncandidate,{font:neverRead,fail}),noncandidate,'noncandidate attribute/metadata stays byte exact without extra font access');const plainActual=await toPng(plain,{fonts}),plainExpected=new Resvg(plain,{fitTo:{mode:'zoom',value:1},background:'#FFFFFF',font:{loadSystemFonts:false,fontFiles:exact.fontFiles,fontDirs:[],defaultFontFamily:'Roboto',sansSerifFamily:'Roboto',monospaceFamily:'Roboto Mono'},logLevel:'off'}).render().asPng();assert.equal(hash(plainActual),hash(plainExpected),'ordinary external PNG bytes unchanged');groups++;
 // Caller file/folder and no-bundled modes use the exact same selected bytes;
 // no fresh default-font handle can override the custom face.
 const custom=path.join(scratch,'fonts');await mkdir(custom);const files=[];for(const [index,file]of exact.fontFiles.entries()){const target=path.join(custom,`${index}.ttf`);await writeFile(target,await readFile(file));files.push(target);}
 for(const options of [{fontFiles:files,useBundledFonts:false},[custom]]){
  const candidate=await toPng(svg,{fonts:options,onDiagnostic:d=>limited.push(d)});assert.equal(hash(candidate),hash(png),'same exact caller files/folder raster output');
 }
 assert.deepEqual(limited,[]);const defaultDeck={language:'ar-SA',slides:[{title:'Default',items:['البند: 12'],numbering:'arabic'}]},defaultIssues=[];await toPng(defaultDeck,1,{onDiagnostic:d=>defaultIssues.push(d)});assert(!defaultIssues.some(d=>d.code==='raster-marker-unavailable'),'actual default bundled handle has an eligible marker face');groups++;
 // System-only/unresolved selection stays text with an explicit limitation.
 for(const font of [{...exact,loadSystemFonts:true},{...exact,fontFiles:[],fontDirs:[]}]){const issues=[],kept=await outlineRasterMarkers(svg,{font,report:d=>issues.push(d),fail});assert.match(kept,/<text[^>]*data-opf-number-marker="rtl"/);assert(issues.some(d=>d.code==='raster-marker-unavailable'));assert.equal(await outlineRasterMarkers(plain,{font,report:()=>assert.fail('ordinary input diagnostic'),fail}),plain);}
 // A real Roboto-only library plus generic serif reproduces the silent
 // bestAny branch: Times New Roman is absent, but a different face is usable.
 const described=fonts.registry.describeFaces(),exported=fonts.registry.exportFaces(),roboto=described.findIndex(face=>face.family==='Roboto'&&face.weight===400&&!face.italic);assert(roboto>=0);const robotoFile=path.join(scratch,'Roboto-only.ttf');await writeFile(robotoFile,exported[roboto].data);
 const generic='<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><text data-opf-number-marker="rtl" direction="rtl" unicode-bidi="isolate" aria-hidden="true" x="100" y="50" text-anchor="start" font-family="serif" font-size="30">1.</text></svg>',genericIssues=[];
 assert.equal(await outlineRasterMarkers(generic,{font:{...exact,fontFiles:[robotoFile],fontDirs:[]},report:issue=>genericIssues.push(issue),fail}),generic,'missing generic family cannot outline another usable face');assert(genericIssues.some(issue=>issue.code==='raster-marker-unavailable'&&issue.reason==='unresolved'));
 groups++;
 // Actual sfnt tables, not mocked face.unusable values: replace the glyf/loca
 // tables of the bundled open face with a valid simple CFF charstring index.
 const base=fonts.registry.exportFaces()[0].data;
 function permissions(input,bits){const bytes=Buffer.from(input),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);for(let i=0;i<view.getUint16(4);i++){const at=12+i*16;if(bytes.toString('ascii',at,at+4)==='OS/2')view.setUint16(view.getUint32(at+8)+8,bits);}return bytes;}
 function cffFixture(input){const bytes=Buffer.from(input),tables=[];let glyphs=0;for(let i=0;i<bytes.readUInt16BE(4);i++){const at=12+i*16,tag=bytes.toString('ascii',at,at+4),offset=bytes.readUInt32BE(at+8),size=bytes.readUInt32BE(at+12);if(tag==='maxp')glyphs=bytes.readUInt16BE(offset+4);if(!['glyf','loca','maxp'].includes(tag))tables.push([tag,bytes.subarray(offset,offset+size)]);}const index=list=>{if(!list.length)return Buffer.from([0,0]);const total=list.reduce((n,b)=>n+b.length,1),size=total<=255?1:total<=65535?2:4,head=Buffer.alloc(3+(list.length+1)*size);head.writeUInt16BE(list.length);head[2]=size;let offset=1;for(let i=0;i<=list.length;i++){head.writeUIntBE(offset,3+i*size,size);if(i<list.length)offset+=list[i].length;}return Buffer.concat([head,...list]);};const names=index([Buffer.from('MarkerPermission')]),topOffset=4+names.length+index([Buffer.alloc(6)]).length+4,dict=Buffer.alloc(6);dict[0]=29;dict.writeUInt32BE(topOffset,1);dict[5]=17;const charstring=Buffer.from([139,139,21,239,139,139,239,39,139,139,39,5,14]),cff=Buffer.concat([Buffer.from([1,0,4,4]),names,index([dict]),Buffer.from([0,0,0,0]),index(Array.from({length:glyphs},()=>charstring))]),maxp=Buffer.alloc(6);maxp.writeUInt32BE(0x5000);maxp.writeUInt16BE(glyphs,4);tables.push(['CFF ',cff],['maxp',maxp]);tables.sort((a,b)=>a[0].localeCompare(b[0]));const head=Buffer.alloc(12+tables.length*16);head.write('OTTO');head.writeUInt16BE(tables.length,4);let cursor=head.length;const chunks=[head];tables.forEach(([tag,data],i)=>{const at=12+i*16;head.write(tag,at);head.writeUInt32BE(cursor,at+8);head.writeUInt32BE(data.length,at+12);chunks.push(data);const padding=(4-data.length%4)%4;if(padding)chunks.push(Buffer.alloc(padding));cursor+=data.length+padding;});return Buffer.concat(chunks);}
 for(const cff of [false,true])for(const bits of [0,4,8,0x100,2,0x200]){
  const data=permissions(cff?cffFixture(base):base,bits);assert.equal(fsTypeOf(data),bits);const handle=await loadFonts({pack:'base',faces:[{data,family:'MarkerPermission',weight:400}]});try{const library=outlineLibrary(handle),face=library.faces.find(f=>f.names.has('markerpermission'));assert(face);if(cff){assert(face.font.directory.tables['CFF ']);assert(face.font.getGlyph(0).path.commands.length>0,'real CFF charstring is decoded');}const allowed=![2,0x200].includes(bits);assert.equal(face.embeddable,allowed,`${cff?'CFF':'TTF'} actual fsType`);assert.equal(library.restricted.has('markerpermission'),!allowed);const result=handle.outlines.outlineSlideText(['<text x="20" y="40" font-family="MarkerPermission" font-size="20">1.</text>'],{fail,report:()=>{}});assert.equal(result.content[0].includes('<use '),allowed,'permissive CFF/TTF outlines, restricted stays text');}finally{handle.dispose?.();}
 }
 groups++;
 console.log(JSON.stringify({passed:true,groups,actualPng:{bytes:png.length,sha256:hash(png)},nativePixelsAccepted:false}));
}catch(error){await writeFile(new URL('failure.json',folder),JSON.stringify({name:error.name,message:error.message,stack:error.stack,diagnostics},null,2)+'\n').catch(()=>{});throw error;}finally{fonts.dispose?.();await rm(scratch,{recursive:true,force:true});}
