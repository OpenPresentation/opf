// Shared pure OOXML reader. No CLI/profile module or product engine dependency.
import assert from 'node:assert/strict';
import {b07CurrentShapeBound} from './b07-current-source.mjs';

export const integer=(value,min,max)=>assert.ok(Number.isSafeInteger(value)&&value>=min&&value<=max,'Out-of-bounds integer');
export const literal=(value,max)=>assert.ok(typeof value==='string'&&value.length>0&&value.length<=max,'Bounded nonempty literal required');

/** Ordered OOXML; never group all a:r before a:br or trim the native text. */
export function b07NativeShapes(xml,XMLParser,source){
  const shapeBound=b07CurrentShapeBound(source);
  const parser=new XMLParser({preserveOrder:true,ignoreAttributes:false,attributeNamePrefix:'',parseTagValue:false,parseAttributeValue:false,trimValues:false});
  const child=(nodes,key)=>nodes.flatMap(node=>node[key]?[node]:[]),one=(nodes,key)=>{const found=child(nodes,key);assert.equal(found.length,1,'Expected one '+key);return found[0];};
  const document=parser.parse(xml),slide=one(document,'p:sld'),common=one(slide['p:sld'],'p:cSld'),tree=one(common['p:cSld'],'p:spTree')['p:spTree'];
  assert.ok(tree.filter(node=>['p:sp','p:pic','p:graphicFrame','p:grpSp','p:cxnSp'].some(key=>Object.hasOwn(node,key))).length<=shapeBound);if(shapeBound===22)assert.equal(tree.filter(node=>['p:sp','p:pic','p:graphicFrame','p:grpSp','p:cxnSp'].some(key=>Object.hasOwn(node,key))).length,22);assert.equal(child(tree,'p:grpSp').length,0,'Nested groups need separate review');
  const shapes=child(tree,'p:sp').map(node=>{
    const content=node['p:sp'],nv=one(content,'p:nvSpPr'),identity=one(nv['p:nvSpPr'],'p:cNvPr')[':@'];const id=Number(identity.id);integer(id,1,2147483647);literal(identity.name,255);const bodies=child(content,'p:txBody');let text='';const runs=[];
    if(bodies.length){assert.equal(bodies.length,1);for(const [index,p]of child(bodies[0]['p:txBody'],'a:p').entries()){
      if(index)text+='\r';const ppr=child(p['a:p'],'a:pPr')[0]?.['a:pPr']??[],defaults=child(ppr,'a:defRPr')[0];
      for(const entry of p['a:p']){if(Object.hasOwn(entry,'a:br')){text+='\v';continue;}if(!Object.hasOwn(entry,'a:r'))continue;const parts=entry['a:r'],t=one(parts,'a:t')['a:t'];assert.ok(t.every(part=>Object.hasOwn(part,'#text')));const value=t.map(part=>part['#text']).join(''),properties=child(parts,'a:rPr')[0]??defaults,attrs={...defaults?.[':@'],...properties?.[':@']},latin=child(properties?.['a:rPr']??properties?.['a:defRPr']??[],'a:latin')[0]?.[':@']?.typeface??child(defaults?.['a:defRPr']??[],'a:latin')[0]?.[':@']?.typeface;
        const flag=value=>value===undefined||value==='0'?0:value==='1'?-1:null;
        const style={name:latin,sizePoints:Number(attrs.sz)/100,bold:flag(attrs.b),italic:flag(attrs.i)};runs.push({start1Based:text.length+1,text:value,style,rawProperties:properties??null});text+=value;
      }
    }}return {id,name:identity.name,text,runs,raw:node};
  });assert.equal(new Set(shapes.map(shape=>shape.id)).size,shapes.length);assert.equal(new Set(shapes.map(shape=>shape.name)).size,shapes.length);return shapes;
}
