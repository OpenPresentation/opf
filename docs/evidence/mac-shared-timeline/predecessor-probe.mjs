import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {prepareNodeFonts} from '/Users/michael/Source/opf-render/dist/fonts-node.js';
import {renderSvg,resolvePresentation} from '/Users/michael/Source/opf-render/dist/svg.js';
import {composeSlide} from '/Users/michael/.codex/worktrees/c193/opf/packages/javascript/dist/composition.js';
const {options}=await prepareNodeFonts(),results=[];
for(const count of [2,4,8,12])for(const [width,height]of [[1280,720],[720,1280]])for(const minimum of [16,32]){
 const events=Array.from({length:count},(_,i)=>({when:`Q${i+1}`,what:`Milestone ${i+1}`,description:'Keep every label inside its allocated space.'}));
 const deck={design:{fontScheme:'roboto',dimensions:{widthInches:width/96,heightInches:height/96}},slides:[{title:'Timeline acceptance',composition:{minFontSize:minimum,overflow:'error'},timeline:{events}}]};
 const result={count,width,height,minimum,sourceSha256:createHash('sha256').update(JSON.stringify(deck)).digest('hex')};
 try{const bound=resolvePresentation(deck,options).slides[0];result.coreDiagnostics=bound.geometry.diagnostics;result.box=bound.geometry.items.find(item=>item.field==='timeline').box;}catch(error){result.coreError={message:error.message,code:error.code,details:error.details};}
 try{renderSvg(deck,options);result.render='passed';}catch(error){result.renderError={message:error.message,code:error.code,details:error.details};}
 results.push(result);
}
await writeFile(process.argv[2],JSON.stringify({node:process.version,core:'ade2a4f0a8afa93f546a3b1e18f2ed23b84d0ac7',renderer:'c7a7387f6e27cc21eeeec3015492afe289ec4ce3',results},null,2)+'\n');
console.log(JSON.stringify(results.map(({count,width,height,minimum,coreDiagnostics,coreError,render,renderError})=>({count,width,height,minimum,coreDiagnostics,coreError,render,renderError})),null,2));
