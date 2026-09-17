import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {prepareNodeFonts} from '/Users/michael/Source/opf-render/dist/fonts-node.js';
import {renderSvg,resolvePresentation} from '/Users/michael/Source/opf-render/dist/svg.js';
import {toPptx} from '/Users/michael/Source/opf-pptx/dist/index.js';
const require=createRequire('/Users/michael/Source/opf-pptx/package.json'),{unzipSync}=require('fflate'),{XMLParser}=require('fast-xml-parser');
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,trimValues:false}),hash=value=>createHash('sha256').update(value).digest('hex'),{options}=await prepareNodeFonts(),results=[];
for(const [width,height]of [[1280,720],[720,1280]])for(const floor of [16,32]){
 const header='Authored header words',footer='Authored footer words';
 const source={design:{fontScheme:'roboto',dimensions:{widthInches:width/96,heightInches:height/96},header:{left:{text:header}},footer:{left:{text:footer},right:{slideNumber:true}}},slides:[{title:'Furniture control',text:'Body stays present.',composition:{minFontSize:floor,overflow:'error'}}]};
 const before=hash(JSON.stringify(source)),bound=resolvePresentation(source,options).slides[0],svg=renderSvg(source,{...options,trace:true}),pptx=await toPptx(source,options),entries=unzipSync(pptx);
 const root=parser.parse(new TextDecoder().decode(entries['ppt/slides/slide1.xml'])),texts=[];
 const visit=value=>{if(!value||typeof value!=='object')return;for(const [key,child]of Object.entries(value))if(key==='a:t')texts.push(String(child));else if(Array.isArray(child))child.forEach(visit);else visit(child);};visit(root);
 const furniture=[...svg.matchAll(/<text\b[^>]*data-opf-path="design\.(?:header|footer)\.[^"]+"[^>]*>[^]*?<\/text>/g)].map(match=>({svg:match[0],fontSize:Number(/font-size="([^"]+)"/.exec(match[0])?.[1])}));
 results.push({width,height,floor,source,sourceSha256:before,sourceUnchanged:before===hash(JSON.stringify(source)),coreDiagnostics:bound.geometry.diagnostics,svgSha256:hash(svg),pptxSha256:hash(pptx),furniture,nativeTexts:texts,nativeHasHeader:texts.includes(header),nativeHasFooter:texts.includes(footer)});
}
await writeFile(process.argv[2],JSON.stringify({node:process.version,core:'cc4b5245ba1c197746a2c307b78ff58f45df02cc',renderer:'1e5cd95a76e356c09ae5da0c8604809a202b1f40',pptx:'6f06406d9615b35a66f39e6424b35b1d32a73052',scope:'Read-only shared header/footer gap probe; parsed PPTX current text only, no native Office execution.',results},null,2)+'\n');
console.log(results.map(({width,height,floor,furniture,nativeHasHeader,nativeHasFooter})=>({width,height,floor,sizes:furniture.map(item=>item.fontSize),nativeHasHeader,nativeHasFooter})));
