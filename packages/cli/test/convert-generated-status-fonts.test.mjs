import assert from'node:assert/strict';
import{test,after}from'node:test';
import{spawnSync}from'node:child_process';
import{mkdir,mkdtemp,readFile,rm,writeFile}from'node:fs/promises';
import path from'node:path';
import{fileURLToPath}from'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url)),artifacts=path.join(root,'artifacts');await mkdir(artifacts,{recursive:true});const temp=await mkdtemp(path.join(artifacts,'lh121-cli-'));after(async()=>{assert.ok(path.resolve(temp).startsWith(path.resolve(artifacts)+path.sep));await rm(temp,{recursive:true,force:true})});
const executable=process.env.OPF_TEST_BIN??fileURLToPath(new URL('../dist/index.js',import.meta.url));
for(const[language,slideLanguage,words]of[['ar-SA',undefined,['مكتمل','حالي','مخطط']],['en-US','zh-TW',['已完成','目前','計畫']]])test('LH121: shipping CLI prepares generated '+(slideLanguage??language)+' statuses from otherwise Latin-only source',async()=>{
 const events=['done','current','planned'].map((status,index)=>({when:'Week '+(index+1),what:['Discover','Build','Launch'][index],status})),document={language,design:{fontScheme:'roboto'},slides:[{title:'Release plan',...(slideLanguage?{language:slideLanguage}:{}),timeline:events}]},id=(slideLanguage??language),input=path.join(temp,id+'.opf.json');await writeFile(input,JSON.stringify(document));
 for(const ext of['png','pptx']){const output=path.join(temp,id+'.'+ext),result=spawnSync(process.execPath,[executable,'convert',input,output,'--date','2026-11-08',...(ext==='png'?['--scale','.5']:[])],{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});assert.equal(result.error,undefined);assert.equal(result.status,0,JSON.stringify({ext,stdout:result.stdout,stderr:result.stderr}));const bytes=await readFile(output);if(ext==='png'){assert.ok(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));assert.equal(bytes.readUInt32BE(16),640);assert.equal(bytes.readUInt32BE(20),360)}else{const{fromPptx}=await import('@openpresentation/opf-pptx');const imported=await fromPptx(bytes,{signals:true});assert.deepEqual(imported.presentation.slides[0].timeline,events);const nativeText=imported.signals.slides[0].shapes.flatMap(shape=>shape.text?.paragraphs.flatMap(p=>p.runs.map(run=>run.text))??[]).join('\n');for(const word of words)assert.ok(nativeText.includes(word),'actual native generated text '+word)}}
});
