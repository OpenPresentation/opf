/** Validate positive JSON Schema examples at their declaring schema node, plus embedded catalog records.
 * Run without arguments for the checkout, or --preview-index <candidate index.json> to check a packed gallery candidate. */
import {readFile,readdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(new URL('../packages/javascript/package.json',import.meta.url));
const Ajv=require('ajv/dist/2020.js').default;
const formats=require('ajv-formats').default;
const kinds={layouts:'layout',themes:'theme',colorSchemes:'color-scheme',fontSchemes:'font-scheme',narratives:'narrative',audiences:'audience',purposes:'purpose',tones:'tone'};
const pointerEscape=value=>value.replaceAll('~','~0').replaceAll('/','~1');
export async function checkSchemaExamples({schemaRoot=path.join(root,'spec/schemas'),previewIndex}={}){
  const schemas=new Map();const ajv=new Ajv({strict:false,allErrors:true,allowUnionTypes:true});formats(ajv);
  for(const file of (await readdir(schemaRoot)).filter(file=>file.endsWith('.schema.json'))){
    const schema=JSON.parse(await readFile(path.join(schemaRoot,file),'utf8'));schemas.set(file,schema);ajv.addSchema(schema);
  }
  const failures=[];let examples=0,records=0;
  const check=(ref,value,where)=>{if(!ajv.validate({$ref:ref},value))failures.push(`${where}: ${ajv.errorsText(ajv.errors,{separator:'; '})}`);};
  const checkGroup=(group,where)=>{
    if(!group||typeof group!=='object'||Array.isArray(group))return;
    for(const [kind,values] of Object.entries(group)){
      const companion=schemas.get(`${kinds[kind]}.schema.json`);if(!companion||!values||typeof values!=='object'||Array.isArray(values))continue;
      for(const [id,record] of Object.entries(values)){
        records++;
        if(record&&typeof record==='object'&&Object.keys(record).some(key=>key==='id'||key==='$schema'||key.startsWith('x-')))failures.push(`${where}/${kind}/${id}: embedded identity/display metadata must be omitted`);
        check(companion.$id,{$schema:companion.$id,id,...record},`${where}/${kind}/${id}`);
      }
    }
  };
  const checkCatalogs=(value,where)=>{if(value&&typeof value==='object')for(const [id,group] of Object.entries(value))checkGroup(group,`${where}/${id}`);};
  const embedded=(value,where)=>{
    if(!value||typeof value!=='object')return;
    if(value.catalogs)checkCatalogs(value.catalogs,`${where}/catalogs`);
    for(const [key,item] of Object.entries(value))embedded(item,`${where}/${pointerEscape(key)}`);
  };
  for(const [file,schema] of schemas){
    const walk=(node,pointer)=>{
      if(!node||typeof node!=='object')return;
      if(Array.isArray(node.examples))for(const [index,value] of node.examples.entries()){
        const where=`${file}#${pointer}/examples/${index}`;examples++;
        check(`${schema.$id}#${pointer}`,value,where);embedded(value,where);
        if(pointer==='/\u0024defs/Catalogs')checkCatalogs(value,where);
        if(pointer==='/\u0024defs/CatalogGroup'||pointer==='/\u0024defs/Catalogs/properties/default')checkGroup(value,where);
      }
      const schemaMap=['properties','patternProperties','$defs','definitions','dependentSchemas'].some(key=>pointer.endsWith(`/${key}`));
      for(const [key,value] of Object.entries(node))if(schemaMap||!['examples','default','const','enum'].includes(key))walk(value,`${pointer}/${pointerEscape(key)}`);
    };
    walk(schema,'');
  }
  if(previewIndex){
    const index=JSON.parse(await readFile(previewIndex,'utf8'));
    check(schemas.get('layout-preview-index.schema.json').$id,index,previewIndex);
    const catalogPath=path.resolve(path.dirname(previewIndex),'../../catalog/layouts/index.json');
    const catalog=JSON.parse(await readFile(catalogPath,'utf8'));
    if(JSON.stringify(index.records?.map(record=>record.id))!==JSON.stringify(catalog.records.map(record=>record.id)))failures.push(`${previewIndex}: previews must match catalog layout ids in catalog order`);
    for(const record of index.records??[]){
      if(record.file!==`${record.id}.svg`){failures.push(`${previewIndex}: ${record.id} must name its matching SVG file`);continue;}
      const content=await readFile(path.join(path.dirname(previewIndex),record.file),'utf8');
      if(Buffer.byteLength(content,'utf8')!==record.bytes)failures.push(`${previewIndex}: ${record.file} byte length differs`);
      if(!/^<svg(?:\s|>)/u.test(content.trimStart()))failures.push(`${previewIndex}: ${record.file} is not a self-contained SVG`);
    }
  }
  return {valid:failures.length===0,schemas:schemas.size,examples,embeddedRecords:records,failures};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const flag=process.argv.indexOf('--preview-index');
  const report=await checkSchemaExamples({previewIndex:flag===-1?path.join(root,'packages/gallery/previews/layouts/index.json'):process.argv[flag+1]});
  console.log(JSON.stringify(report,null,2));if(!report.valid)process.exitCode=1;
}
