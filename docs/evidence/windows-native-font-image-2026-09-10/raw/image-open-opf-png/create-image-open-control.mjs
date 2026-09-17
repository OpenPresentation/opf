import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {toPptx} from '../dist/index.js';
import PptxGenJS from '../vendor/pptxgenjs/pptxgen.es.js';
const bytes=await readFile('test/fixtures/images/wide.png'),src='data:image/png;base64,'+bytes.toString('base64');
for(const kind of ['opf-png','vendor-png']){
 const dir='artifacts/image-open-'+kind;await mkdir(dir);
 let output;
 if(kind==='opf-png')output=await toPptx({design:{theme:'classic'},slides:[{image:{src,alt:'PNG control'}}]});
 else{const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.addSlide().addImage({data:src,x:1,y:1,w:10,h:5});output=await pptx.write({outputType:'nodebuffer'});}
 await writeFile(dir+'/source.pptx',output);await writeFile(dir+'/generation.json',JSON.stringify({kind,pptxSha256:createHash('sha256').update(output).digest('hex')})+'\n');
}
