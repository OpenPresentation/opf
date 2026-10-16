// Internal import safety policy, shared by PPTX and nested workbook/introspection readers.
// No caller-provided limits and no claim that ZIP CRC/provenance authenticates the source.
import {unzipSync, Unzip, UnzipInflate} from 'fflate';
import {OPFPptxError} from './errors.js';
const MiB=1024*1024;
export const INPUT_LIMITS=Object.freeze({compressedBytes:64*MiB,members:10000,memberBytes:64*MiB,expandedBytes:256*MiB,xmlBytes:16*MiB,xmlDepth:256,nestedDepth:16});
const states=new WeakMap();
const xmlPart=name=>/\.(?:xml|rels)$/i.test(name);
const invalid=(message,path)=>new OPFPptxError('invalid-pptx',message,path===undefined?{}:{path});
function limit(name,actual,path){
 const maximum=INPUT_LIMITS[name];
 if(actual>maximum)throw new OPFPptxError('pptx-limit-exceeded',`PPTX ${name} exceeds the supported limit (${maximum}).`,{limit:name,maximum,actual,...(path===undefined?{}:{path})});
}
function memberName(name){
 if(typeof name!=='string'||!name||/[\\\x00-\x1f]/.test(name)||name.startsWith('/')||/^[a-z]:/i.test(name)||name.split('/').some((p,i,a)=>p==='.'||p==='..'||p===''&&i!==a.length-1))throw invalid('PPTX contains a noncanonical ZIP member name.',name);
}
function checkXml(bytes,path){
 limit('xmlBytes',bytes.length,path);
 // Check nesting before any recursive parser/tree walk; skip comments, CDATA and PIs.
 // Reject DTDs entirely: OOXML parts do not need document entities or external declarations.
 let text;
 const encoding=bytes[0]===0xff&&bytes[1]===0xfe?'utf-16le':bytes[0]===0xfe&&bytes[1]===0xff?'utf-16be':'utf-8';
 try{text=new TextDecoder(encoding,{fatal:true}).decode(bytes);}catch{throw invalid('PPTX XML is not valid encoded text.',path);}
 const declarations=text.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>/g,'');
 if(/<!DOCTYPE\b|<!ENTITY\b/i.test(declarations))throw invalid('PPTX XML document entities are not supported.',path);
 const stack=[];
 // Count broad XML name tokens, including Unicode/namespace names the OOXML parser
 // accepts. This is a resource preflight, not a replacement XML grammar validator.
 const tokens=/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/?[^\s<>\/"'=!?]+(?:[^<>"']|"[^"]*"|'[^']*')*>/g;
 for(const [token]of text.matchAll(tokens)){
  if(token.startsWith('<?')||token.startsWith('<!'))continue;
  const name=/^<\/?([^\s<>\/"'=!?]+)/.exec(token)[1];
  if(token.startsWith('</')){if(stack.pop()!==name)throw invalid('PPTX XML has an unmatched closing element.',path);}
  else {limit('xmlDepth',stack.length+1,path);if(!/\/\s*>$/.test(token))stack.push(name);}
 }
 if(stack.length)throw invalid('PPTX XML has unclosed elements.',path);
}
function stateOf(entries){
 let state=states.get(entries);
 if(!state){
  const budget={members:0,expanded:0};state={budget,depth:0,cache:new Map()};
  for(const [name,bytes]of Object.entries(entries)){
   memberName(name);if(!(bytes instanceof Uint8Array))throw invalid('PPTX member is not bytes.',name);
   limit('members',++budget.members,name);limit('memberBytes',bytes.length,name);budget.expanded+=bytes.length;limit('expandedBytes',budget.expanded,name);
   if(xmlPart(name))checkXml(bytes,name);
  }
  states.set(entries,state);
 }
 return state;
}
export function checkInputEntries(entries){stateOf(entries);return entries;}

export function readInputZip(input,{budget={members:0,expanded:0},depth=0,path}={}){
 const bytes=input instanceof ArrayBuffer?new Uint8Array(input):input;
 if(!(bytes instanceof Uint8Array))throw invalid('PPTX input must be a Uint8Array or ArrayBuffer.',path);
 limit('compressedBytes',bytes.length,path);limit('nestedDepth',depth,path);
 const metadata=new Map();let declared=0;
 try{
  // fflate's central-directory iterator supplies names/sizes without allocating expanded data
  // when filter always returns false. Do not use its fixed-size inflate output for untrusted data:
  // a dishonest originalSize can silently truncate a DEFLATE stream in unzipSync.
  unzipSync(bytes,{filter(file){
   memberName(file.name);
   if(metadata.has(file.name))throw invalid('PPTX repeats a ZIP member name.',file.name);
   limit('members',budget.members+metadata.size+1,file.name);
   if(!Number.isSafeInteger(file.size)||file.size<0||file.size>bytes.length||!Number.isSafeInteger(file.originalSize)||file.originalSize<0)throw invalid('PPTX has invalid ZIP member sizes.',file.name);
   if(![0,8].includes(file.compression))throw invalid('PPTX uses an unsupported ZIP compression method.',file.name);
   limit('memberBytes',file.originalSize,file.name);
   if(xmlPart(file.name))limit('xmlBytes',file.originalSize,file.name);
   declared+=file.originalSize;limit('expandedBytes',budget.expanded+declared,file.name);
   metadata.set(file.name,file);return false;
  }});
  const entries=Object.create(null),seen=new Set();let failure;
  const unzip=new Unzip(file=>{
   const expected=metadata.get(file.name);
   if(!expected||seen.has(file.name))throw invalid('PPTX local ZIP members do not match its directory.',file.name);
   seen.add(file.name);
   if(file.compression!==expected.compression||file.size!==undefined&&file.size!==expected.size||file.originalSize!==undefined&&file.originalSize!==expected.originalSize)throw invalid('PPTX local and directory sizes or methods disagree.',file.name);
   let count=0;const chunks=[];
   file.ondata=(error,chunk,final)=>{
    if(failure)return;
    try{
     if(error)throw error;
     count+=chunk.length;limit('memberBytes',count,file.name);
     if(count>expected.originalSize)throw invalid('PPTX expands beyond its declared member size.',file.name);
     budget.expanded+=chunk.length;limit('expandedBytes',budget.expanded,file.name);
     chunks.push(chunk);
     if(final){
      if(count!==expected.originalSize)throw invalid('PPTX expanded member size differs from its directory.',file.name);
      const data=new Uint8Array(count);let at=0;for(const part of chunks){data.set(part,at);at+=part.length;}chunks.length=0;
      if(xmlPart(file.name))checkXml(data,file.name);
      entries[file.name]=data;
     }
    }catch(error){failure=error;}
   };
   file.start();
  });
  unzip.register(UnzipInflate);
  // A 4KiB compressed feed bounds an individual inflater emission (~4MiB at DEFLATE's
  // maximum expansion) before our actual-output counter can reject dishonest metadata.
  for(let at=0;at<bytes.length;at+=4096){unzip.push(bytes.subarray(at,at+4096),at+4096>=bytes.length);if(failure)throw failure;}
  if(seen.size!==metadata.size||Object.keys(entries).length!==metadata.size)throw invalid('PPTX ZIP members are missing or incomplete.',path);
  budget.members+=metadata.size;states.set(entries,{budget,depth,cache:new Map()});return entries;
 }catch(error){
  if(error instanceof OPFPptxError)throw error;
  throw new OPFPptxError('invalid-pptx','PPTX input is not a readable ZIP archive.',{...(path===undefined?{}:{path}),cause:error instanceof Error?error.message:String(error)});
 }
}
export function readNestedInputZip(entries,path){
 const state=stateOf(entries);
 const cached=state.cache.get(path),source=entries[path];
 if(cached?.source===source)return cached.entries;
 const nested=readInputZip(source,{budget:state.budget,depth:state.depth+1,path});
 state.cache.set(path,{source,entries:nested});return nested;
}
