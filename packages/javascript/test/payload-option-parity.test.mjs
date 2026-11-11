// The schema states which options belong to which kind of block (ContentPayload dependentSchemas), so any JSON Schema tool knows what
// the format check knows. This keeps the two in step: for every such option on every kind of block, the schema alone and `validate`
// agree, and a misplaced option is one finding at the option that says where it belongs, never a raw copy beside it.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {validate} from '../dist/index.js';
const schema=JSON.parse(readFileSync(new URL('../../../spec/schemas/opf.schema.json',import.meta.url),'utf8'));
const ajv=new Ajv2020({allErrors:true,strict:false,allowUnionTypes:true});addFormats(ajv);ajv.addSchema(schema);
const payloadValid=ajv.getSchema(`${schema.$id}#/$defs/ContentPayload`);
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const samples={fit:'cover',focus:{x:.5,y:.5},recolor:'grayscale',overlay:{color:'#000000',opacity:.4},placement:{edge:'top'},portrait:'avatar',aspectRatio:1.5,adjust:{adj:.3},stroke:{width:2},opacity:.5,
 fill:'accent1',style:'subtle',rotate:10,flip:'horizontal',anchor:'top',padding:8,textDirection:'vertical',alt:'A shape',decorative:true,hidden:true,link:'https://example.com',shadow:'soft',innerShadow:{blur:4},glow:{radius:4},softEdge:4,reflection:{size:.3},blur:4,
 path:'M0 0 L10 0 L10 10 Z',caption:'A caption'};
const kinds={text:{text:'Body'},list:{items:['One','Two']},image:{image:{src:image,alt:'A picture'}},chart:{chart:{type:'column',alt:'Two bars',data:{columns:['Q','A'],rows:[['Q1',1],['Q2',2]]}}},table:{table:{rows:[['a','b']]}},
 metric:{metric:{value:42,label:'Decks'}},shape:{shape:'roundRect',text:'Plan'},group:{blocks:[{text:'One'},{text:'Two'}]}};
const OPTION_RULES=['opf/image-option-unsupported-payload','opf/shape-option-unsupported-payload','opf/caption-unsupported-payload'];
const formatErrors=block=>validate({name:'Parity',language:'en-US',slides:[{title:'Slide',blocks:[block]}]},{only:['format']}).findings.filter(f=>f.severity==='error');

test('every option the schema ties to a kind has a sample here, and the schema lists no option the check does not know',()=>{
 const dependent=Object.keys(schema.$defs.ContentPayload.dependentSchemas).sort();
 assert.deepEqual(dependent,Object.keys(samples).sort());
});

test('the schema alone and the format check agree on every option on every kind of block',()=>{
 const disagreements=[];
 for(const [key,value] of Object.entries(samples))for(const [kind,base] of Object.entries(kinds)){
  if(key==='path'&&kind!=='image')continue; // a path makes any block a shape block; only beside an image is it misplaced
  const block={...base,[key]:value},schemaOk=payloadValid(block)===true,found=formatErrors(block);
  const option=found.filter(f=>f.path===`/slides/0/blocks/0/${key}`);
  if(schemaOk!==(found.length===0))disagreements.push(`${key} on ${kind}: schema ${schemaOk?'accepts':'rejects'}, validate reports ${found.length} (${found.map(f=>f.ruleId+' '+f.path).join('; ')})`);
  // A misplaced option is one finding, at the option, from the format check (its help says where the option belongs).
  if(!schemaOk&&key!=='path'){if(found.length!==1||option.length!==1||!OPTION_RULES.includes(option[0].ruleId))disagreements.push(`${key} on ${kind}: expected one located option finding, got ${found.map(f=>f.ruleId+' '+f.path+' '+f.message).join(' | ')}`);}
 }
 assert.deepEqual(disagreements,[]);
});

test('a slide caption without a captionable root payload is rejected by the schema and reported once',()=>{
 const slideValid=ajv.getSchema(`${schema.$id}#/$defs/Slide`);
 assert.equal(slideValid({title:'T',text:'Short',caption:'Not here'}),false);assert.equal(slideValid({title:'T',image:{src:image,alt:'A'},caption:'Here'}),true);
 const found=validate({name:'Parity',language:'en-US',slides:[{title:'T',text:'Short',caption:'Not here'}]},{only:['format']}).findings.filter(f=>f.severity==='error');
 assert.equal(found.length,1,JSON.stringify(found.map(f=>f.message)));assert.equal(found[0].ruleId,'opf/caption-unsupported-payload');
});
